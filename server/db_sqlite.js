const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const runQuery = (sql, params = []) => {
    // Basic translation from PostgreSQL $1, $2 to SQLite ?
    // Also remove RETURNING clause which SQLite doesn't like in all versions
    let processedSql = sql.replace(/\$\d+/g, '?');
    processedSql = processedSql.replace(/RETURNING \w+/gi, '');

    return new Promise((resolve, reject) => {
        if (processedSql.trim().toUpperCase().startsWith('INSERT') ||
            processedSql.trim().toUpperCase().startsWith('UPDATE') ||
            processedSql.trim().toUpperCase().startsWith('DELETE')) {
            db.run(processedSql, params, function(err) {
                if (err) reject(err);
                else resolve({ rows: [{ id: this.lastID }], lastID: this.lastID, changes: this.changes });
            });
        } else {
            db.all(processedSql, params, (err, rows) => {
                if (err) reject(err);
                else resolve({ rows });
            });
        }
    });
};

const initDb = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                password TEXT,
                full_name TEXT,
                avatar TEXT,
                plan TEXT DEFAULT 'Free',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS notebooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT,
                description TEXT,
                icon TEXT,
                color TEXT,
                is_deleted INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                category_id INTEGER,
                name TEXT,
                type TEXT,
                content TEXT,
                url TEXT,
                file_path TEXT,
                is_deleted INTEGER DEFAULT 0,
                scheduled_delete_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                // If column category_id missing because table already existed, add it
                if (!err) {
                    db.run("ALTER TABLE sources ADD COLUMN category_id INTEGER", (e) => {});
                }
            });
            db.run(`CREATE TABLE IF NOT EXISTS notebook_sources (
                notebook_id INTEGER,
                source_id INTEGER,
                is_active INTEGER DEFAULT 1,
                PRIMARY KEY (notebook_id, source_id)
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notebook_id INTEGER,
                user_id INTEGER,
                title TEXT,
                content TEXT,
                is_deleted INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS trash (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                item_id INTEGER,
                item_type TEXT,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT,
                message TEXT,
                type TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                device_name TEXT,
                location TEXT,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS flashcards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notebook_id INTEGER,
                user_id INTEGER,
                question TEXT,
                answer TEXT,
                difficulty TEXT,
                next_review TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS source_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER,
                content TEXT,
                embedding TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
};

module.exports = {
    query: runQuery,
    pool: { connect: () => ({ query: runQuery, release: () => {} }) }, // partial mock
    initDb
};
