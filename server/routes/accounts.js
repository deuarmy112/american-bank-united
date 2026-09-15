const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateId, generateAccountNumber } = require('../utils/helpers');

const router = express.Router();

function normalizeAccountIdentifier(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function accountIdentifierMatches(account, identifier) {
    const input = normalizeAccountIdentifier(identifier);
    const accountNumber = normalizeAccountIdentifier(account.account_number);
    const storedIban = normalizeAccountIdentifier(account.iban);
    const inputDigits = input.replace(/[^0-9]/g, '');
    const accountDigits = accountNumber.replace(/[^0-9]/g, '');

    return Boolean(input) && (
        input === accountNumber ||
        input === storedIban ||
        (inputDigits.length >= 10 && inputDigits.slice(-10) === accountDigits.slice(-10)) ||
        (inputDigits.length >= 6 && accountDigits.endsWith(inputDigits))
    );
}

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

// Look up an active ABU account by account number or IBAN digits
router.get('/lookup', authenticateToken, async (req, res) => {
    try {
        const identifier = String(req.query.identifier || '').trim();
        const result = await pool.query(
            `SELECT a.id, a.account_number, a.account_type, u.first_name, u.last_name, u.email
             FROM accounts a JOIN users u ON u.id = a.user_id
             WHERE a.status = 'active'
             LIMIT 1000`
        );
        const matches = result.rows.filter(row => accountIdentifierMatches(row, identifier));
        const account = matches.length === 1 ? matches[0] : null;
        if (!account) return res.status(404).json({ error: 'ABU account not found' });
        res.json({
            id: account.id,
            accountNumber: account.account_number,
            accountType: account.account_type,
            recipientName: `${account.first_name || ''} ${account.last_name || ''}`.trim(),
            recipientEmail: account.email || ''
        });
    } catch (error) {
        console.error('Account lookup error:', error);
        res.status(500).json({ error: 'Unable to look up ABU account' });
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
            `INSERT INTO accounts (id, user_id, account_number, account_type, balance, status, approval_status) 
             VALUES ($1, $2, $3, $4, 0.00, 'inactive', 'pending')`,
            [accountId, req.user.userId, accountNumber, accountType]
        );

        const result = await pool.query(
            'SELECT * FROM accounts WHERE id = $1',
            [accountId]
        );

        res.status(201).json({
            message: 'Account created successfully. Pending admin approval.',
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
