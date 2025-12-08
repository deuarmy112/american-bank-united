const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateId, generateAccountNumber } = require('../utils/helpers');

const router = express.Router();

// Get all accounts for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM accounts WHERE user_id = $1 AND status = \'active\' ORDER BY created_at DESC',
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Fetch accounts error:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// Get single account by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Fetch account error:', error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
});

// Create new account
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { accountType } = req.body;

        if (!['checking', 'savings', 'business'].includes(accountType)) {
            return res.status(400).json({ error: 'Invalid account type' });
        }

        const accountId = generateId();
        const accountNumber = generateAccountNumber();

        await pool.query(
            `INSERT INTO accounts (id, user_id, account_number, account_type, balance, status) 
             VALUES ($1, $2, $3, $4, 0.00, 'active')`,
            [accountId, req.user.userId, accountNumber, accountType]
        );

        const result = await pool.query(
            'SELECT * FROM accounts WHERE id = $1',
            [accountId]
        );

        res.status(201).json({
            message: 'Account created successfully',
            account: result.rows[0]
        });

    } catch (error) {
        console.error('Create account error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Get account transactions
router.get('/:id/transactions', authenticateToken, async (req, res) => {
    try {
        // Verify account belongs to user
        const accountResult = await pool.query(
            'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const result = await pool.query(
            'SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 100',
            [req.params.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Fetch transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

module.exports = router;
