-- QUICK SETUP: Transaction Approval System
-- Copy and paste this into Render PostgreSQL Shell

-- Step 1: Add approval columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Step 2: Create index for pending transactions
CREATE INDEX IF NOT EXISTS idx_transactions_approval ON transactions(approval_status);

-- Step 3: Update existing transactions to approved status
UPDATE transactions SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = '';

-- Step 4: Create transaction approval settings table
CREATE TABLE IF NOT EXISTS transaction_approval_settings (
    id SERIAL PRIMARY KEY,
    setting_name VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 5: Insert default approval thresholds
INSERT INTO transaction_approval_settings (setting_name, setting_value, description) VALUES
    ('withdrawal_threshold', '1000', 'Withdrawals above this amount require approval (USD)'),
    ('transfer_threshold', '5000', 'Transfers above this amount require approval (USD)'),
    ('require_all_approvals', 'false', 'If true, ALL transactions require approval'),
    ('auto_approve_small', 'true', 'Auto-approve transactions below threshold')
ON CONFLICT (setting_name) DO NOTHING;

-- Done! Transaction approval system is now installed.
-- Access at: https://american-bank-united.vercel.app/admin-approvals.html
-- 
-- Default Settings:
-- - Withdrawals above $1,000 require approval
-- - Transfers above $5,000 require approval
-- - Can be configured in the admin portal
