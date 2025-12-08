-- Add transaction approval system

-- Add approval columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index for pending transactions
CREATE INDEX IF NOT EXISTS idx_transactions_approval ON transactions(approval_status);

-- Create pending_transactions view for admin
CREATE OR REPLACE VIEW pending_transactions_view AS
SELECT 
    t.*,
    a.account_number,
    a.account_type,
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone
FROM transactions t
JOIN accounts a ON t.account_id = a.id
JOIN users u ON a.user_id = u.id
WHERE t.approval_status = 'pending'
ORDER BY t.created_at ASC;

-- Update existing transactions to approved status
UPDATE transactions SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = '';

-- Create transaction approval settings table
CREATE TABLE IF NOT EXISTS transaction_approval_settings (
    id SERIAL PRIMARY KEY,
    setting_name VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default approval thresholds
INSERT INTO transaction_approval_settings (setting_name, setting_value, description) VALUES
    ('withdrawal_threshold', '1000', 'Withdrawals above this amount require approval (USD)'),
    ('transfer_threshold', '5000', 'Transfers above this amount require approval (USD)'),
    ('require_all_approvals', 'false', 'If true, ALL transactions require approval'),
    ('auto_approve_small', 'true', 'Auto-approve transactions below threshold')
ON CONFLICT (setting_name) DO NOTHING;
