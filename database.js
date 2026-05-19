const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chaya.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT NOT NULL,
                total TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                items TEXT NOT NULL, -- JSON string of cart items
                payment_status TEXT DEFAULT 'pending',
                bkash_payment_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);
            
            // Try to add columns for existing tables (ignore errors if they already exist)
            db.run(`ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'`, (err) => {});
            db.run(`ALTER TABLE orders ADD COLUMN bkash_payment_id TEXT`, (err) => {});

            db.run(`CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                material TEXT NOT NULL,
                area_size INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }
});

module.exports = db;
