const { Pool } = require('pg');
require('dotenv').config();

// Database connection pool
// Supports both DATABASE_URL (production) and individual variables (development)
const poolConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
} : {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'american_bank_united',
    port: process.env.DB_PORT || 5432,
    ssl: false, // Explicitly disable SSL for local development
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // Add additional options to ensure no SSL
    connectionString: undefined // Force individual params
};

const pool = new Pool(poolConfig);

// Test database connection
async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

module.exports = { pool, testConnection };
