const { Client } = require('pg');

async function initTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('📡 Connected to database');

        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                date_of_birth DATE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        console.log('✅ Users table created');

        // Accounts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                account_number VARCHAR(20) UNIQUE NOT NULL,
                account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('checking', 'savings', 'business')),
                balance DECIMAL(15, 2) DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_accounts_number ON accounts(account_number)`);
        console.log('✅ Accounts table created');

        // Transactions table
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id VARCHAR(36) PRIMARY KEY,
                account_id VARCHAR(36) NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'bill_payment')),
                amount DECIMAL(15, 2) NOT NULL,
                description TEXT,
                related_account_id VARCHAR(36),
                balance_after DECIMAL(15, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at)`);
        console.log('✅ Transactions table created');

        // Cards table
        await client.query(`
            CREATE TABLE IF NOT EXISTS cards (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                linked_account_id VARCHAR(36) NOT NULL,
                card_number VARCHAR(16) UNIQUE NOT NULL,
                card_type VARCHAR(20) NOT NULL CHECK (card_type IN ('debit', 'credit')),
                design VARCHAR(50) DEFAULT 'classic',
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'expired')),
                expiry_date DATE NOT NULL,
                cvv VARCHAR(3) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE CASCADE
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_cards_number ON cards(card_number)`);
        console.log('✅ Cards table created');

        // Billers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS billers (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                category VARCHAR(20) NOT NULL CHECK (category IN ('utilities', 'internet', 'phone', 'insurance', 'credit-card', 'loan')),
                name VARCHAR(200) NOT NULL,
                account_number VARCHAR(100) NOT NULL,
                nickname VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_billers_user_id ON billers(user_id)`);
        console.log('✅ Billers table created');

        // Bill payments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS bill_payments (
                id VARCHAR(36) PRIMARY KEY,
                biller_id VARCHAR(36) NOT NULL,
                from_account_id VARCHAR(36) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                payment_date DATE NOT NULL,
                memo TEXT,
                status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (biller_id) REFERENCES billers(id) ON DELETE CASCADE,
                FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_bill_payments_biller ON bill_payments(biller_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(payment_date)`);
        console.log('✅ Bill Payments table created');

        console.log('\n🎉 All tables created successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

initTables();
