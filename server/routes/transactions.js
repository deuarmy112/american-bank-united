const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { transferValidation, validate } = require('../middleware/validation');
const { generateId } = require('../utils/helpers');

const router = express.Router();

// Helper function to check if transaction needs approval
async function needsApproval(type, amount) {
    try {
        // Get approval settings
        const settings = await pool.query(
            'SELECT setting_name, setting_value FROM transaction_approval_settings'
        );
        
        const settingsMap = {};
        settings.rows.forEach(row => {
            settingsMap[row.setting_name] = row.setting_value;
        });

        // If require all approvals is enabled
        if (settingsMap.require_all_approvals === 'true') {
            return true;
        }

        // Check thresholds
        const transferThreshold = parseFloat(settingsMap.transfer_threshold || 5000);
        const withdrawalThreshold = parseFloat(settingsMap.withdrawal_threshold || 1000);

        if (type === 'transfer' && parseFloat(amount) >= transferThreshold) {
            return true;
        }

        if (type === 'withdrawal' && parseFloat(amount) >= withdrawalThreshold) {
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error checking approval:', error);
        // Default to not requiring approval if settings table doesn't exist yet
        return false;
    }
}

// Get all transactions for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.* FROM transactions t
             INNER JOIN accounts a ON t.account_id = a.id
             WHERE a.user_id = $1
             ORDER BY t.created_at DESC
             LIMIT 200`,
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Fetch transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Transfer money between accounts
router.post('/transfer', authenticateToken, transferValidation, validate, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const { fromAccountId, toAccountId, amount, description } = req.body;

        if (fromAccountId === toAccountId) {
            throw new Error('Cannot transfer to the same account');
        }

        // Verify from account belongs to user
        const fromResult = await client.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 AND status = $3',
            [fromAccountId, req.user.userId, 'active']
        );

        if (fromResult.rows.length === 0) {
            throw new Error('Source account not found');
        }

        const fromAccount = fromResult.rows[0];

        if (parseFloat(fromAccount.balance) < parseFloat(amount)) {
            throw new Error('Insufficient funds');
        }

        // Verify to account exists
        const toResult = await client.query(
            'SELECT * FROM accounts WHERE id = $1 AND status = $2',
            [toAccountId, 'active']
        );

        if (toResult.rows.length === 0) {
            throw new Error('Destination account not found');
        }

        const toAccount = toResult.rows[0];

        // Check if approval is needed
        const requiresApproval = await needsApproval('transfer', amount);

        if (requiresApproval) {
            // Create pending transaction records without updating balances
            const withdrawalId = generateId();
            await client.query(
                `INSERT INTO transactions (id, account_id, type, amount, description, related_account_id, balance_after, approval_status)
                 VALUES ($1, $2, 'transfer', $3, $4, $5, $6, 'pending')`,
                [withdrawalId, fromAccountId, amount, description || 'Transfer out (Pending Approval)', toAccountId, fromAccount.balance]
            );

            await client.query('COMMIT');

            return res.json({
                message: 'Transfer submitted for admin approval',
                status: 'pending_approval',
                transactionId: withdrawalId,
                requiresApproval: true
            });
        }

        // Auto-approved: Execute transfer immediately
        const newFromBalance = parseFloat(fromAccount.balance) - parseFloat(amount);
        await client.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newFromBalance, fromAccountId]
        );

        const newToBalance = parseFloat(toAccount.balance) + parseFloat(amount);
        await client.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newToBalance, toAccountId]
        );

        // Create withdrawal transaction
        const withdrawalId = generateId();
        await client.query(
            `INSERT INTO transactions (id, account_id, type, amount, description, related_account_id, balance_after, approval_status)
             VALUES ($1, $2, 'transfer', $3, $4, $5, $6, 'approved')`,
            [withdrawalId, fromAccountId, amount, description || 'Transfer out', toAccountId, newFromBalance]
        );

        // Create deposit transaction
        const depositId = generateId();
        await client.query(
            `INSERT INTO transactions (id, account_id, type, amount, description, related_account_id, balance_after, approval_status)
             VALUES ($1, $2, 'deposit', $3, $4, $5, $6, 'approved')`,
            [depositId, toAccountId, amount, description || 'Transfer in', fromAccountId, newToBalance]
        );

        await client.query('COMMIT');

        res.json({
            message: 'Transfer completed successfully',
            status: 'approved',
            withdrawalId,
            depositId,
            newBalance: newFromBalance
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transfer error:', error);
        res.status(400).json({ error: error.message || 'Transfer failed' });
    } finally {
        client.release();
    }
});

module.exports = router;
