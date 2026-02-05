const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = process.env.NODE_ENV === 'test' ? require('./db_sqlite') : require('./db');
require('dotenv').config();
const ai = require('./ai');
const ingestion = require('./ingestion');

const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user ? req.user.id : 'anonymous';
        const userDir = path.join('uploads', userId.toString());
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        // Use UUID to prevent path traversal and filename collisions
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOCX, MD, and TXT are allowed.'));
        }
    }
});
app.use(cors());
app.use(express.json());
// Sensitive request logging removed for production safety
app.use(express.static('public'));

app.get('/api/ai-health', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ status: hasKey ? 'ok' : 'missing_api_key', service: 'Google Gemini' });
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error("FATAL: JWT_SECRET environment variable is required in production.");
    process.exit(1);
}
const ACTUAL_JWT_SECRET = JWT_SECRET || 'dev-secret-key-only';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, ACTUAL_JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Auth Routes ---

app.post('/api/register', async (req, res) => {
    const { email, password, full_name } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email format' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING id',
            [email, hashedPassword, full_name]
        );
        const userId = result.rows[0].id;

        await db.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
            [userId, 'Chào mừng!', 'Chào mừng bạn đến với Kho Tri Thức. Hãy bắt đầu bằng cách tạo notebook đầu tiên nhé.', 'info']
        );

        res.status(201).json({ message: 'User created', userId });
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user) return res.status(400).json({ error: 'User not found' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        // Log session
        const deviceName = req.headers['user-agent'] || 'Unknown Device';
        await db.query('INSERT INTO sessions (user_id, device_name, location) VALUES ($1, $2, $3)',
            [user.id, deviceName, 'Local Access']);

        const token = jwt.sign({ id: user.id, email: user.email }, ACTUAL_JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, avatar: user.avatar } });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.patch('/api/profile', authenticateToken, async (req, res) => {
    const { full_name, avatar } = req.body;
    try {
        const updates = [];
        const params = [];
        if (full_name) { updates.push(`full_name = $${updates.length+1}`); params.push(full_name); }
        if (avatar) { updates.push(`avatar = $${updates.length+1}`); params.push(avatar); }
        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
        params.push(req.user.id);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
        res.json({ message: 'Profile updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/notebooks/:id', authenticateToken, async (req, res) => {
    try {
        const nbRes = await db.query('SELECT name FROM notebooks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (nbRes.rows.length === 0) return res.status(404).json({ error: 'Notebook not found' });
        const name = nbRes.rows[0].name;

        await db.query('UPDATE notebooks SET is_deleted = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        await db.query('INSERT INTO trash (user_id, item_id, item_type, item_name, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, req.params.id, 'notebook', name, new Date(Date.now() + 30*24*60*60*1000)]);
        res.json({ message: 'Notebook moved to trash' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    try {
        const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        const valid = await bcrypt.compare(oldPassword, user.password);
        if (!valid) return res.status(400).json({ error: 'Invalid old password' });
        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
        res.json({ message: 'Password changed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT id, email, full_name, avatar as avatar_url, plan FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Category Routes ---

app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM categories WHERE user_id = $1 ORDER BY created_at ASC', [req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { name } = req.body;
    try {
        const result = await db.query('INSERT INTO categories (user_id, name) VALUES ($1, $2) RETURNING *', [req.user.id, name]);
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/categories/:id', authenticateToken, async (req, res) => {
    const { name } = req.body;
    try {
        await db.query('UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3', [name, req.params.id, req.user.id]);
        res.json({ message: 'Category updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Category deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Sources (Drive Files) Routes ---

app.get('/api/sources', authenticateToken, async (req, res) => {
    const { q } = req.query;
    try {
        let sql = 'SELECT *, name as title, name as filename FROM sources WHERE user_id = $1 AND is_deleted = 0';
        const params = [req.user.id];

        if (q) {
            sql += ' AND name ILIKE $2';
            params.push(`%${q}%`);
        }

        sql += ' ORDER BY created_at DESC';
        const result = await db.query(sql, params);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sources', authenticateToken, upload.single('file'), async (req, res) => {
    let { name, type, content, url, category_id } = req.body;
    const filePath = req.file ? req.file.path : null;

    if (req.file && !name) {
        name = req.file.originalname;
    }

    if (filePath) {
        const extracted = await ingestion.extractText(filePath, req.file.mimetype);
        if (extracted) {
            content = extracted;
        }
    }

    if (!content && !url) {
        content = "Empty source";
    }

    try {
        if (category_id) {
            const catCheck = await db.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [category_id, req.user.id]);
            if (catCheck.rows.length === 0) return res.status(403).json({ error: 'Unauthorized category' });
        }

        const result = await db.query(
            'INSERT INTO sources (user_id, category_id, name, type, content, url, file_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [req.user.id, category_id || null, name, type, content, url, filePath]
        );
        const source = result.rows[0];

        // Asynchronously process source (chunking & embedding)
        // Note: In production, this should ideally be handled by a worker queue.
        ingestion.processSource(source.id, source.content).catch(err => console.error("Async ingestion failed:", err));

        res.status(201).json(source);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/sources/:id', authenticateToken, async (req, res) => {
    const { name, scheduled_delete_at, category_id } = req.body;
    try {
        if (category_id) {
            const catCheck = await db.query('SELECT id FROM categories WHERE id = $1 AND user_id = $2', [category_id, req.user.id]);
            if (catCheck.rows.length === 0) return res.status(403).json({ error: 'Unauthorized category' });
        }

        const updates = [];
        const params = [];
        if (name) { updates.push(`name = $${updates.length + 1}`); params.push(name); }
        if (scheduled_delete_at !== undefined) { updates.push(`scheduled_delete_at = $${updates.length + 1}`); params.push(scheduled_delete_at); }
        if (category_id !== undefined) { updates.push(`category_id = $${updates.length + 1}`); params.push(category_id); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(req.params.id, req.user.id);
        await db.query(`UPDATE sources SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length}`, params);
        res.json({ message: 'Source updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/sources/:id', authenticateToken, async (req, res) => {
    try {
        const sourceRes = await db.query('SELECT name FROM sources WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (sourceRes.rows.length === 0) return res.status(404).json({ error: 'Source not found' });
        const name = sourceRes.rows[0].name;

        // Move to trash: keep file but mark as deleted
        await db.query('UPDATE sources SET is_deleted = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        await db.query('INSERT INTO trash (user_id, item_id, item_type, item_name, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, req.params.id, 'source', name, new Date(Date.now() + 30*24*60*60*1000)]);
        res.json({ message: 'Source moved to trash' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Notebooks Routes ---

app.get('/api/notebooks', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM notebooks WHERE user_id = $1 AND is_deleted = 0 ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/notebooks/:id', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM notebooks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Notebook not found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/notebooks', authenticateToken, async (req, res) => {
    const { name, description, icon, color, sourceIds } = req.body;
    try {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Verify all sourceIds belong to the user
            if (sourceIds && sourceIds.length > 0) {
                const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(',');
                const checkRes = await client.query(
                    `SELECT id FROM sources WHERE id IN (${placeholders}) AND user_id = $${sourceIds.length + 1}`,
                    [...sourceIds, req.user.id]
                );
                if (checkRes.rows.length !== sourceIds.length) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({ error: 'Unauthorized source selection' });
                }
            }

            const result = await client.query(
                'INSERT INTO notebooks (user_id, name, description, icon, color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [req.user.id, name, description, icon, color]
            );
            const notebook = result.rows[0];

            if (sourceIds && sourceIds.length > 0) {
                for (const sid of sourceIds) {
                    await client.query('INSERT INTO notebook_sources (notebook_id, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [notebook.id, sid]);
                }
            }
            await client.query('COMMIT');
            res.status(201).json(notebook);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/notebooks/:id/sources', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT s.*, ns.is_active FROM sources s JOIN notebook_sources ns ON s.id = ns.source_id WHERE ns.notebook_id = $1 AND s.user_id = $2 AND s.is_deleted = 0',
            [req.params.id, req.user.id]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/notebooks/:id/link-source', authenticateToken, async (req, res) => {
    const { sourceId } = req.body;
    try {
        // Ownership check for both notebook and source
        const check = await db.query(
            'SELECT n.id FROM notebooks n CROSS JOIN sources s WHERE n.id = $1 AND s.id = $2 AND n.user_id = $3 AND s.user_id = $3',
            [req.params.id, sourceId, req.user.id]
        );
        if (check.rows.length === 0) return res.status(403).json({ error: 'Unauthorized access' });

        await db.query('INSERT INTO notebook_sources (notebook_id, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, sourceId]);
        res.json({ message: 'Source linked to notebook' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/notebooks/:id/sources/:sourceId', authenticateToken, async (req, res) => {
    const { is_active } = req.body;
    try {
        // Ownership check
        const check = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (check.rows.length === 0) return res.status(403).json({ error: 'Unauthorized access' });

        await db.query('UPDATE notebook_sources SET is_active = $1 WHERE notebook_id = $2 AND source_id = $3', [is_active ? 1 : 0, req.params.id, req.params.sourceId]);
        res.json({ message: 'Source status updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Notes Routes ---

app.get('/api/notebooks/:id/notes', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM notes WHERE notebook_id = $1 AND user_id = $2 AND is_deleted = 0', [req.params.id, req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/notes', authenticateToken, async (req, res) => {
    const { notebook_id, title, content } = req.body;
    try {
        const nbCheck = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [notebook_id, req.user.id]);
        if (nbCheck.rows.length === 0) return res.status(403).json({ error: 'Unauthorized notebook' });

        const result = await db.query(
            'INSERT INTO notes (notebook_id, user_id, title, content) VALUES ($1, $2, $3, $4) RETURNING *',
            [notebook_id, req.user.id, title, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/notes/:id', authenticateToken, async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await db.query('UPDATE notes SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4',
            [title, content, req.params.id, req.user.id]);
        res.json({ message: 'Note updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
    try {
        const noteRes = await db.query('SELECT title FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (noteRes.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        const name = noteRes.rows[0].title;

        await db.query('UPDATE notes SET is_deleted = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        await db.query('INSERT INTO trash (user_id, item_id, item_type, item_name, expires_at) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, req.params.id, 'note', name, new Date(Date.now() + 30*24*60*60*1000)]);
        res.json({ message: 'Note moved to trash' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Notifications ---

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Notification marked as read' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Sessions ---

app.get('/api/sessions', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_active DESC', [req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Session terminated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Flashcards ---

app.get('/api/notebooks/:id/flashcards', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM flashcards WHERE notebook_id = $1 AND user_id = $2 ORDER BY created_at DESC', [req.params.id, req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/flashcards', authenticateToken, async (req, res) => {
    const { notebook_id, question, answer } = req.body;
    try {
        const nbCheck = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [notebook_id, req.user.id]);
        if (nbCheck.rows.length === 0) return res.status(403).json({ error: 'Unauthorized notebook' });

        const result = await db.query(
            'INSERT INTO flashcards (notebook_id, user_id, question, answer) VALUES ($1, $2, $3, $4) RETURNING *',
            [notebook_id, req.user.id, question, answer]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- AI Logic ---

app.post('/api/ai/fast-analysis', authenticateToken, async (req, res) => {
    const { notebookId, sourceIds } = req.body;
    try {
        // Ownership check for notebook
        if (notebookId) {
            const nbCheck = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [notebookId, req.user.id]);
            if (nbCheck.rows.length === 0) return res.status(403).json({ error: 'Unauthorized access to notebook' });
        }

        let sources = [];
        if (sourceIds && sourceIds.length > 0) {
            const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(',');
            const result = await db.query(`SELECT id, name, content FROM sources WHERE id IN (${placeholders}) AND user_id = $${sourceIds.length + 1} AND is_deleted = 0`, [...sourceIds, req.user.id]);
            sources = result.rows;
        } else if (notebookId) {
            const result = await db.query(
                'SELECT s.id, s.name, s.content FROM sources s JOIN notebook_sources ns ON s.id = ns.source_id JOIN notebooks n ON n.id = ns.notebook_id WHERE ns.notebook_id = $1 AND n.user_id = $2 AND s.is_deleted = 0 AND ns.is_active = 1',
                [notebookId, req.user.id]
            );
            sources = result.rows;
        }

        if (sources.length === 0) return res.status(400).json({ error: 'No sources selected or unauthorized access' });

        const result = await ai.fastAnalysis(sources);
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "AI Service error" });
    }
});

app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    const { message, notebookId } = req.body;
    try {
        // Ownership check for notebook
        const nbCheck = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [notebookId, req.user.id]);
        if (nbCheck.rows.length === 0) return res.status(403).json({ error: 'Unauthorized access to notebook' });

        const result = await db.query(
            'SELECT s.id, s.name, s.content FROM sources s JOIN notebook_sources ns ON s.id = ns.source_id JOIN notebooks n ON n.id = ns.notebook_id WHERE ns.notebook_id = $1 AND n.user_id = $2 AND s.is_deleted = 0 AND ns.is_active = 1',
            [notebookId, req.user.id]
        );
        const sources = result.rows;

        const resultAi = await ai.chatWithSources(message, sources);
        res.json(resultAi);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "AI Service error" });
    }
});

app.post('/api/ai/generate-flashcards', authenticateToken, async (req, res) => {
    const { notebookId } = req.body;
    try {
        const nbCheck = await db.query('SELECT id FROM notebooks WHERE id = $1 AND user_id = $2', [notebookId, req.user.id]);
        if (nbCheck.rows.length === 0) return res.status(403).json({ error: 'Unauthorized notebook' });

        const result = await db.query(
            'SELECT s.id, s.name, s.content FROM sources s JOIN notebook_sources ns ON s.id = ns.source_id WHERE ns.notebook_id = $1 AND s.user_id = $2 AND s.is_deleted = 0 AND ns.is_active = 1',
            [notebookId, req.user.id]
        );
        const sources = result.rows;
        if (sources.length === 0) return res.status(400).json({ error: 'No active sources found' });

        const cards = await ai.generateFlashcards(sources);

        for (const card of cards) {
            await db.query('INSERT INTO flashcards (notebook_id, user_id, question, answer) VALUES ($1, $2, $3, $4)',
                [notebookId, req.user.id, card.q, card.a]);
        }

        res.json({ message: `Generated ${cards.length} flashcards`, cards });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "AI Service error" });
    }
});

// --- Trash Management ---

app.get('/api/trash', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM trash WHERE user_id = $1 ORDER BY deleted_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/trash/:id/restore', authenticateToken, async (req, res) => {
    try {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const trashRes = await client.query('SELECT * FROM trash WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
            const item = trashRes.rows[0];
            if (!item) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Trash item not found' });
            }

            if (item.item_type === 'source') {
                await client.query('UPDATE sources SET is_deleted = 0 WHERE id = $1', [item.item_id]);
            } else if (item.item_type === 'notebook') {
                await client.query('UPDATE notebooks SET is_deleted = 0 WHERE id = $1', [item.item_id]);
            }

            await client.query('DELETE FROM trash WHERE id = $1', [req.params.id]);
            await client.query('COMMIT');
            res.json({ message: 'Item restored' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/trash/:id', authenticateToken, async (req, res) => {
    try {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const trashRes = await client.query('SELECT * FROM trash WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
            const item = trashRes.rows[0];
            if (!item) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Trash item not found' });
            }

            if (item.item_type === 'source') {
                const sourceRes = await client.query('SELECT file_path FROM sources WHERE id = $1', [item.item_id]);
                const filePath = sourceRes.rows[0]?.file_path;
                if (filePath) {
                    fs.unlink(path.resolve(filePath), (err) => {
                        if (err) console.error("Failed to delete file:", filePath, err);
                    });
                }
                await client.query('DELETE FROM sources WHERE id = $1', [item.item_id]);
            } else if (item.item_type === 'notebook') {
                await client.query('DELETE FROM notebooks WHERE id = $1', [item.item_id]);
            }

            await client.query('DELETE FROM trash WHERE id = $1', [req.params.id]);
            await client.query('COMMIT');
            res.json({ message: 'Item deleted permanently' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Cleanup Task ---

const cleanup = async () => {
    try {
        const trashItems = await db.query('SELECT * FROM trash WHERE expires_at < CURRENT_TIMESTAMP');
        for (const item of trashItems.rows) {
            if (item.item_type === 'source') {
                const sourceRes = await db.query('SELECT file_path FROM sources WHERE id = $1', [item.item_id]);
                const filePath = sourceRes.rows[0]?.file_path;
                if (filePath) fs.unlink(path.resolve(filePath), (err) => {});
                await db.query('DELETE FROM sources WHERE id = $1', [item.item_id]);
            } else if (item.item_type === 'notebook') {
                await db.query('DELETE FROM notebooks WHERE id = $1', [item.item_id]);
            }
            await db.query('DELETE FROM trash WHERE id = $1', [item.id]);
        }

        const scheduled = await db.query('SELECT * FROM sources WHERE scheduled_delete_at < CURRENT_TIMESTAMP AND is_deleted = 0');
        for (const s of scheduled.rows) {
            await db.query('UPDATE sources SET is_deleted = 1 WHERE id = $1', [s.id]);
            await db.query('INSERT INTO trash (user_id, item_id, item_type, expires_at) VALUES ($1, $2, $3, $4)',
                [s.user_id, s.id, 'source', new Date(Date.now() + 30*24*60*60*1000)]);
        }
    } catch (e) {
        console.error("Cleanup error:", e);
    }
};
setInterval(cleanup, 60 * 60 * 1000);

// --- Start Server ---
const PORT = process.env.PORT || 3000;
db.initDb().then(() => {
    cleanup(); // Run once on startup
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
