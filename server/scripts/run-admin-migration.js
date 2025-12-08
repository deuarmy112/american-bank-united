const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runAdminMigration() {
    const client = await pool.connect();
    try {
        console.log('Starting admin system migration...');
        
        const sqlPath = path.join(__dirname, 'add-admin-system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await client.query(sql);
        
        console.log('✓ Admin system migration completed successfully');
        console.log('\nDefault admin credentials:');
        console.log('Email: admin@americanbankunited.com');
        console.log('Password: Admin@123');
        console.log('\n⚠️  Please change the admin password after first login!');
        
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runAdminMigration();
