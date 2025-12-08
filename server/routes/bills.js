const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateId } = require('../utils/helpers');

const router = express.Router();

// Get all billers for current user
router.get('/billers', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM billers WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Fetch billers error:', error);
        res.status(500).json({ error: 'Failed to fetch billers' });
    }
});

// Add new biller
router.post('/billers', authenticateToken, async (req, res) => {
    try {
        const { category, name, accountNumber, nickname } = req.body;

        const validCategories = ['utilities', 'internet', 'phone', 'insurance', 'credit-card', 'loan'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        const billerId = generateId();

        await pool.query(
            `INSERT INTO billers (id, user_id, category, name, account_number, nickname)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [billerId, req.user.userId, category, name, accountNumber, nickname || null]
        );

        const result = await pool.query(
            'SELECT * FROM billers WHERE id = $1',
            [billerId]
        );

        res.status(201).json({
            message: 'Biller added successfully',
            biller: result.rows[0]
        });

    } catch (error) {
        console.error('Add biller error:', error);
        res.status(500).json({ error: 'Failed to add biller' });
    }
});

// Pay bill
router.post('/payments', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { billerId, fromAccountId, amount, paymentDate, memo } = req.body;

        // Verify biller belongs to user
        const billerResult = await connection.query(
            'SELECT * FROM billers WHERE id = $1 AND user_id = $2',
            [billerId, req.user.userId]
        );

        if (billerResult.rows.length === 0) {
            throw new Error('Biller not found');
        }

        // Verify account belongs to user
        const accountResult = await connection.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 AND status = \'active\'',
            [fromAccountId, req.user.userId]
        );

        if (accountResult.rows.length === 0) {
            throw new Error('Account not found');
        }

        const account = accountResult.rows[0];

        if (parseFloat(account.balance) < parseFloat(amount)) {
            throw new Error('Insufficient funds');
        }

        // Deduct from account
        const newBalance = parseFloat(account.balance) - parseFloat(amount);
        await connection.query(
            'UPDATE accounts SET balance = $1 WHERE id = $2',
            [newBalance, fromAccountId]
        );

        // Create bill payment record
        const paymentId = generateId();
        await connection.query(
            `INSERT INTO bill_payments (id, biller_id, from_account_id, amount, payment_date, memo, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
            [paymentId, billerId, fromAccountId, amount, paymentDate, memo || null]
        );

        // Create transaction
        const transactionId = generateId();
        const biller = billerResult.rows[0];
        await connection.query(
            `INSERT INTO transactions (id, account_id, type, amount, description, balance_after)
             VALUES ($1, $2, 'bill_payment', $3, $4, $5)`,
            [transactionId, fromAccountId, amount, `Bill payment to ${biller.name}`, newBalance]
        );

        await connection.commit();

        res.json({
            message: 'Bill payment completed successfully',
            paymentId,
            newBalance
        });

    } catch (error) {
        await connection.rollback();
        console.error('Bill payment error:', error);
        res.status(400).json({ error: error.message || 'Bill payment failed' });
    } finally {
        connection.release();
    }
});

// Get payment history
router.get('/payments', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT bp.*, b.name as biller_name, b.category
             FROM bill_payments bp
             INNER JOIN billers b ON bp.biller_id = b.id
             INNER JOIN accounts a ON bp.from_account_id = a.id
             WHERE a.user_id = $1
             ORDER BY bp.created_at DESC
             LIMIT 100`,
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Fetch payments error:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

module.exports = router;
