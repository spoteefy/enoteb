const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const db = process.env.NODE_ENV === 'test' ? require('./db_sqlite') : require('./db');
require('dotenv').config();
const ai = require('./ai');

const app = express();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- Auth Routes ---

app.post('/api/register', async (req, res) => {
    const { email, password, full_name } = req.body;
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
    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user) return res.status(400).json({ error: 'User not found' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, avatar: user.avatar } });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
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
    try {
        const result = await db.query('SELECT * FROM sources WHERE user_id = $1 AND is_deleted = 0 ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sources', authenticateToken, upload.single('file'), async (req, res) => {
    let { name, type, content, url, category_id } = req.body;
    const filePath = req.file ? req.file.path : null;

    if (!content && filePath) {
        content = `Nội dung được trích xuất từ tệp ${name}. Đây là một tài liệu quan trọng trong kho tri thức của bạn.`;
    }

    try {
        const result = await db.query(
            'INSERT INTO sources (user_id, category_id, name, type, content, url, file_path) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [req.user.id, category_id || null, name, type, content, url, filePath]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/sources/:id', authenticateToken, async (req, res) => {
    const { name, scheduled_delete_at, category_id } = req.body;
    try {
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
        await db.query('UPDATE sources SET is_deleted = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        await db.query('INSERT INTO trash (user_id, item_id, item_type, expires_at) VALUES ($1, $2, $3, $4)',
            [req.user.id, req.params.id, 'source', new Date(Date.now() + 30*24*60*60*1000)]);
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

app.post('/api/notebooks', authenticateToken, async (req, res) => {
    const { name, description, icon, color, sourceIds } = req.body;
    try {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
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
        await db.query('INSERT INTO notebook_sources (notebook_id, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, sourceId]);
        res.json({ message: 'Source linked to notebook' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/notebooks/:id/sources/:sourceId', authenticateToken, async (req, res) => {
    const { is_active } = req.body;
    try {
        await db.query('UPDATE notebook_sources SET is_active = $1 WHERE notebook_id = $2 AND source_id = $3', [is_active ? 1 : 0, req.params.id, req.params.sourceId]);
        res.json({ message: 'Source status updated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- AI Logic ---

app.post('/api/ai/fast-analysis', authenticateToken, async (req, res) => {
    const { notebookId, sourceIds } = req.body;
    try {
        let sources = [];
        if (sourceIds && sourceIds.length > 0) {
            const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(',');
            const result = await db.query(`SELECT name, content FROM sources WHERE id IN (${placeholders}) AND user_id = $${sourceIds.length + 1}`, [...sourceIds, req.user.id]);
            sources = result.rows;
        } else {
            const result = await db.query(
                'SELECT s.name, s.content FROM sources s JOIN notebook_sources ns ON s.id = ns.source_id WHERE ns.notebook_id = $1 AND ns.is_active = 1',
                [notebookId]
            );
            sources = result.rows;
        }

        if (sources.length === 0) return res.status(400).json({ error: 'No sources selected' });

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
        const result = await db.query(
            'SELECT s.name, s.content FROM sources s JOIN notebook_sources ns ON s.id = ns.source_id WHERE ns.notebook_id = $1 AND ns.is_active = 1',
            [notebookId]
        );
        const sources = result.rows;

        const resultAi = await ai.chatWithSources(message, sources);
        res.json(resultAi);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "AI Service error" });
    }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
db.initDb().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
