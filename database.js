const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize tables on startup
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT NOT NULL,
                total TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                items TEXT NOT NULL,
                payment_status TEXT DEFAULT 'pending',
                bkash_payment_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS quotes (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                material TEXT NOT NULL,
                area_size INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database initialized successfully.');
    } catch (err) {
        console.error('Error initializing database:', err.message);
    } finally {
        client.release();
    }
}

initializeDatabase();

module.exports = pool;
