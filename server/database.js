const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        avatar TEXT,
        plan TEXT DEFAULT 'Free',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Notebooks table
    db.run(`CREATE TABLE IF NOT EXISTS notebooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT,
        description TEXT,
        icon TEXT,
        color TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Sources table
    db.run(`CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notebook_id INTEGER,
        user_id INTEGER,
        name TEXT,
        type TEXT, -- pdf, docx, link, note
        content TEXT,
        url TEXT,
        file_path TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(notebook_id) REFERENCES notebooks(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Notes table
    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notebook_id INTEGER,
        user_id INTEGER,
        title TEXT,
        content TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(notebook_id) REFERENCES notebooks(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Trash table
    db.run(`CREATE TABLE IF NOT EXISTS trash (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        item_id INTEGER,
        item_type TEXT, -- notebook, source, note
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Notifications table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        message TEXT,
        type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Sessions table
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        device_name TEXT,
        location TEXT,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Flashcards table
    db.run(`CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notebook_id INTEGER,
        user_id INTEGER,
        question TEXT,
        answer TEXT,
        difficulty TEXT,
        next_review DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(notebook_id) REFERENCES notebooks(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

module.exports = db;
