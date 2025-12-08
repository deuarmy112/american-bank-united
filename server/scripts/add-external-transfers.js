const { Client } = require('pg');

async function addExternalTransferTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('📡 Connected to database');

        // External transfers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS external_transfers (
                id VARCHAR(36) PRIMARY KEY,
                account_id VARCHAR(36) NOT NULL,
                transfer_type VARCHAR(20) NOT NULL CHECK (transfer_type IN ('p2p', 'ach', 'wire')),
                direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
                amount DECIMAL(15, 2) NOT NULL,
                recipient_name VARCHAR(200),
                recipient_identifier VARCHAR(255),
                bank_name VARCHAR(200),
                routing_number VARCHAR(20),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_external_transfers_account ON external_transfers(account_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_external_transfers_status ON external_transfers(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_external_transfers_created ON external_transfers(created_at)`);
        console.log('✅ External transfers table created');

        // Transfer requests table
        await client.query(`
            CREATE TABLE IF NOT EXISTS transfer_requests (
                id VARCHAR(36) PRIMARY KEY,
                requester_user_id VARCHAR(36) NOT NULL,
                requester_account_id VARCHAR(36) NOT NULL,
                payer_email VARCHAR(255) NOT NULL,
                amount DECIMAL(15, 2) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'declined', 'expired')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP,
                FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (requester_account_id) REFERENCES accounts(id) ON DELETE CASCADE
            )
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_transfer_requests_requester ON transfer_requests(requester_user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_transfer_requests_payer ON transfer_requests(payer_email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status)`);
        console.log('✅ Transfer requests table created');

        console.log('\n🎉 External transfer tables created successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

addExternalTransferTables();
