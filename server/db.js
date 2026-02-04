const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'kho_tri_thuc',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Users table
        await client.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE,
            password TEXT,
            full_name TEXT,
            avatar TEXT,
            plan TEXT DEFAULT 'Free',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Categories table
        await client.query(`CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Notebooks table
        await client.query(`CREATE TABLE IF NOT EXISTS notebooks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            name TEXT,
            description TEXT,
            icon TEXT,
            color TEXT,
            is_deleted INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Sources table (Drive Files)
        await client.query(`CREATE TABLE IF NOT EXISTS sources (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            category_id INTEGER REFERENCES categories(id),
            name TEXT,
            type TEXT, -- pdf, docx, link, note
            content TEXT,
            url TEXT,
            file_path TEXT,
            is_deleted INTEGER DEFAULT 0,
            scheduled_delete_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Notebook-Sources mapping
        await client.query(`CREATE TABLE IF NOT EXISTS notebook_sources (
            notebook_id INTEGER REFERENCES notebooks(id) ON DELETE CASCADE,
            source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
            is_active INTEGER DEFAULT 1, -- used for AI context selection
            PRIMARY KEY (notebook_id, source_id)
        )`);

        // Notes table
        await client.query(`CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            notebook_id INTEGER REFERENCES notebooks(id),
            user_id INTEGER REFERENCES users(id),
            title TEXT,
            content TEXT,
            is_deleted INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Trash table
        await client.query(`CREATE TABLE IF NOT EXISTS trash (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            item_id INTEGER,
            item_type TEXT, -- notebook, source, note, category
            deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        )`);

        // Notifications table
        await client.query(`CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            title TEXT,
            message TEXT,
            type TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Sessions table
        await client.query(`CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            device_name TEXT,
            location TEXT,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Flashcards table
        await client.query(`CREATE TABLE IF NOT EXISTS flashcards (
            id SERIAL PRIMARY KEY,
            notebook_id INTEGER REFERENCES notebooks(id),
            user_id INTEGER REFERENCES users(id),
            question TEXT,
            answer TEXT,
            difficulty TEXT,
            next_review TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.query('COMMIT');
        console.log('Database initialized successfully');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error initializing database', e);
    } finally {
        client.release();
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
    initDb
};
