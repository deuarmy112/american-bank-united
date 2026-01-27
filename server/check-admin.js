const { Client } = require('pg');
require('dotenv').config();

async function checkAdminSetup() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'american_bank_united',
    port: process.env.DB_PORT || 5432
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if admin user exists
    const adminUser = await client.query(
      'SELECT id, first_name, last_name, email, role, status FROM users WHERE email = $1',
      ['admin@americanbankunited.com']
    );

    if (adminUser.rows.length > 0) {
      console.log('✅ Admin user created successfully:');
      console.log('   Email: admin@americanbankunited.com');
      console.log('   Password: Admin@123');
      console.log('   Role:', adminUser.rows[0].role);
      console.log('   Status:', adminUser.rows[0].status);
    } else {
      console.log('❌ Admin user not found');
    }

  } catch (error) {
    console.error('Database check error:', error);
  } finally {
    await client.end();
  }
}

checkAdminSetup();