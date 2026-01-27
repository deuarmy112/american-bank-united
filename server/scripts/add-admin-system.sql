-- Admin System Migration Script

-- Add admin role and status fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'super_admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Add approval status to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Create admin_actions table for audit logging
CREATE TABLE IF NOT EXISTS admin_actions (
    id VARCHAR(36) PRIMARY KEY,
    admin_id VARCHAR(36) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_user_id VARCHAR(36),
    target_account_id VARCHAR(36),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_user ON admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at);

-- Create balance_adjustments table for manual balance changes
CREATE TABLE IF NOT EXISTS balance_adjustments (
    id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL,
    admin_id VARCHAR(36) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('credit', 'debit')),
    reason TEXT NOT NULL,
    balance_before DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_account ON balance_adjustments(account_id);
CREATE INDEX IF NOT EXISTS idx_balance_adjustments_admin ON balance_adjustments(admin_id);

-- Create transaction_reviews table for flagged transactions
CREATE TABLE IF NOT EXISTS transaction_reviews (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL,
    flagged_reason TEXT,
    review_status VARCHAR(20) DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'reversed')),
    reviewed_by VARCHAR(36),
    reviewed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_transaction_reviews_status ON transaction_reviews(review_status);

-- Insert a default admin user (password: Admin@123)
-- Password hash for "Admin@123" using bcrypt with 10 rounds
INSERT INTO users (id, first_name, last_name, email, password_hash, role, status, created_at)
VALUES (
    'admin-system-admin',
    'System',
    'Administrator',
    'admin@americanbankunited.com',
    '$2b$10$XvZ3qQKZQH6YzYx7yN0JoO.Mn0vJ5LRZmFjFpKJ3HOJQ0gzQh8xJq',
    'admin',
    'active',
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- Update existing accounts to be approved by default
UPDATE accounts SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Create view for admin dashboard statistics
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_users,
    (SELECT COUNT(*) FROM users WHERE role = 'customer' AND status = 'active') as active_users,
    (SELECT COUNT(*) FROM accounts WHERE approval_status = 'pending') as pending_accounts,
    (SELECT COUNT(*) FROM accounts) as total_accounts,
    (SELECT COUNT(*) FROM transactions WHERE created_at > CURRENT_DATE - INTERVAL '30 days') as monthly_transactions,
    (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE status = 'active') as total_deposits;
