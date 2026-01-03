const { Pool } = require('pg');

// Generate a secure JWT secret
const crypto = require('crypto');
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('\n🔐 SECURE JWT SECRET (copy this to your .env file):\n');
console.log(`JWT_SECRET=${jwtSecret}\n`);
console.log('Keep this secret safe and never commit it to Git!\n');
