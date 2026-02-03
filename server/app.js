const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const db = require('./database');
require('dotenv').config();

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
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
        db.run(`INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)`,
        [email, hashedPassword, full_name], function(err) {
            if (err) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            res.status(201).json({ message: 'User created', userId: this.lastID });
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'User not found' });
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, avatar: user.avatar } });
    });
});

app.get('/api/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, email, full_name, avatar, plan FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(user);
    });
});

// --- Notebooks Routes ---

app.get('/api/notebooks', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM notebooks WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, notebooks) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(notebooks);
    });
});

app.post('/api/notebooks', authenticateToken, (req, res) => {
    const { name, description, icon, color } = req.body;
    db.run(`INSERT INTO notebooks (user_id, name, description, icon, color) VALUES (?, ?, ?, ?, ?)`,
    [req.user.id, name, description, icon, color], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name, description, icon, color });
    });
});

app.get('/api/notebooks/:id', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM notebooks WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, notebook) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
        res.json(notebook);
    });
});

app.delete('/api/notebooks/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM notebooks WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Notebook deleted' });
    });
});

// --- Sources Routes ---

app.get('/api/notebooks/:notebookId/sources', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM sources WHERE notebook_id = ? AND user_id = ?`, [req.params.notebookId, req.user.id], (err, sources) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(sources);
    });
});

app.post('/api/notebooks/:notebookId/sources', authenticateToken, upload.single('file'), (req, res) => {
    const { name, type, content, url } = req.body;
    const filePath = req.file ? req.file.path : null;
    db.run(`INSERT INTO sources (notebook_id, user_id, name, type, content, url, file_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.params.notebookId, req.user.id, name, type, content, url, filePath], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name, type, filePath });
    });
});

app.delete('/api/sources/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM sources WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Source deleted' });
    });
});

// --- Notes Routes ---

app.get('/api/notebooks/:notebookId/notes', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM notes WHERE notebook_id = ? AND user_id = ?`, [req.params.notebookId, req.user.id], (err, notes) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(notes);
    });
});

app.post('/api/notebooks/:notebookId/notes', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    db.run(`INSERT INTO notes (notebook_id, user_id, title, content) VALUES (?, ?, ?, ?)`,
    [req.params.notebookId, req.user.id, title, content], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, title, content });
    });
});

app.put('/api/notes/:id', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    db.run(`UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    [title, content, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Note updated' });
    });
});

// --- Trash Routes ---

app.post('/api/trash', authenticateToken, (req, res) => {
    const { item_id, item_type } = req.body;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    db.run(`INSERT INTO trash (user_id, item_id, item_type, expires_at) VALUES (?, ?, ?, ?)`,
    [req.user.id, item_id, item_type, expiresAt.toISOString()], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, message: 'Item moved to trash' });
    });
});

app.get('/api/trash', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM trash WHERE user_id = ?`, [req.user.id], (err, items) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(items);
    });
});

app.delete('/api/trash/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM trash WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Item deleted permanently' });
    });
});

// --- AI Mock Routes ---

app.post('/api/ai/chat', authenticateToken, (req, res) => {
    const { message, context } = req.body;
    // Simple mock AI logic
    const response = `Based on your context (${context ? context.length : 0} sources), here is what I found about "${message}": This is a simulated AI response tailored to your query.`;
    res.json({ response });
});

app.post('/api/ai/analyze', authenticateToken, (req, res) => {
    const { sourceIds } = req.body;
    res.json({
        summary: "Dựa trên các tài liệu đã chọn, hệ thống nhận thấy một sự tập trung mạnh mẽ vào việc mở rộng thị trường tại khu vực Đông Nam Á trong năm tới.",
        topics: [
            { title: "Tăng trưởng thị trường", description: "Dự báo tăng trưởng 20% tại Việt Nam." },
            { title: "Chuyển đổi số", description: "Đề xuất thay thế hệ thống ERP cũ." }
        ],
        actions: [
            "Lập kế hoạch ngân sách cho AI",
            "Họp với đội ngũ Logistics"
        ]
    });
});

// --- Settings Routes ---

app.put('/api/settings/profile', authenticateToken, (req, res) => {
    const { full_name, bio } = req.body;
    db.run(`UPDATE users SET full_name = ? WHERE id = ?`, [full_name, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Profile updated' });
    });
});

// --- Notifications ---

app.get('/api/notifications', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, notifications) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(notifications);
    });
});

// --- Placeholder for other routes ---

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
