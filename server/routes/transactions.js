const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { transferValidation, validate } = require('../middleware/validation');
const { generateId } = require('../utils/helpers');

const router = express.Router();

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
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { fromAccountId, toAccountId, amount, description } = req.body;

        if (fromAccountId === toAccountId) {
            throw new Error('Cannot transfer to the same account');
        }

        // Verify from account belongs to user
        const fromResult = await connection.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 AND status = \'active\'',
            [fromAccountId, req.user.userId]
        );

        if (fromResult.rows.length === 0) {
            throw new Error('Source account not found');
        }

        const fromAccount = fromResult.rows[0];

        if (parseFloat(fromAccount.balance) < parseFloat(amount)) {
            throw new Error('Insufficient funds');
        }

        // Verify to account exists
        const toResult = await connection.query(
            'SELECT * FROM accounts WHERE id = $1 AND status = \'active\'',
            [toAccountId]
        );

        if (toResult.rows.length === 0) {
            throw new Error('Destination account not found');
        }

        const toAccount = toResult.rows[0];

        // Deduct from source account
        const newFromBalance = parseFloat(fromAccount.balance) - parseFloat(amount);
        await connection.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newFromBalance, fromAccountId]
        );

        // Add to destination account
        const newToBalance = parseFloat(toAccount.balance) + parseFloat(amount);
        await connection.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newToBalance, toAccountId]
        );

        // Create withdrawal transaction
        const withdrawalId = generateId();
        await connection.query(
            `INSERT INTO transactions (id, account_id, type, amount, description, related_account_id, balance_after)
             VALUES ($1, $2, 'withdrawal', $3, $4, $5, $6)`,
            [withdrawalId, fromAccountId, amount, description || 'Transfer out', toAccountId, newFromBalance]
        );

        // Create deposit transaction
        const depositId = generateId();
        await connection.query(
            `INSERT INTO transactions (id, account_id, type, amount, description, related_account_id, balance_after)
             VALUES ($1, $2, 'deposit', $3, $4, $5, $6)`,
            [depositId, toAccountId, amount, description || 'Transfer in', fromAccountId, newToBalance]
        );

        await connection.commit();

        res.json({
            message: 'Transfer completed successfully',
            withdrawalId,
            depositId,
            newBalance: newFromBalance
        });

    } catch (error) {
        await connection.rollback();
        console.error('Transfer error:', error);
        res.status(400).json({ error: error.message || 'Transfer failed' });
    } finally {
        connection.release();
    }
});

module.exports = router;
