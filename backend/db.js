/**
 * Database Connection Module
 * 
 * Mengelola koneksi ke PostgreSQL menggunakan connection pool.
 * Konfigurasi diambil dari environment variables.
 */

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'water_monitoring',
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max:      10,              // Maximum pool size
  idleTimeoutMillis: 30000,  // Close idle clients after 30s
});

// Log connection events
pool.on('connect', () => {
  console.log('[DB] Client connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS now');
    client.release();
    console.log(`[DB] Connected successfully at ${result.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('[DB] Connection test failed:', err.message);
    return false;
  }
}

module.exports = { pool, testConnection };
