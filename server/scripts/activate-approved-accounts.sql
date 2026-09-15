-- Make all approved legacy accounts usable while preserving pending/rejected accounts.
UPDATE accounts
SET status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE approval_status = 'approved'
  AND status <> 'active';