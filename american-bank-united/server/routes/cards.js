const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateId, generateCardNumber, generateCVV } = require('../utils/helpers');

const router = express.Router();

// Get all cards for current user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM cards WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Fetch cards error:', error);
        res.status(500).json({ error: 'Failed to fetch cards' });
    }
});

// Request new card
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { cardType, linkedAccountId, design } = req.body;

        if (!['debit', 'credit'].includes(cardType)) {
            return res.status(400).json({ error: 'Invalid card type' });
        }

        // Verify account belongs to user
        const accountResult = await pool.query(
            'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
            [linkedAccountId, req.user.userId]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const cardId = generateId();
        const cardNumber = generateCardNumber();
        const cvv = generateCVV();
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 3); // 3 years from now

        await pool.query(
            `INSERT INTO cards (id, user_id, linked_account_id, card_number, card_type, design, status, expiry_date, cvv)
             VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)`,
            [cardId, req.user.userId, linkedAccountId, cardNumber, cardType, design || 'classic', expiryDate, cvv]
        );

        const result = await pool.query(
            'SELECT * FROM cards WHERE id = $1',
            [cardId]
        );

        res.status(201).json({
            message: 'Card created successfully',
            card: result.rows[0]
        });

    } catch (error) {
        console.error('Create card error:', error);
        res.status(500).json({ error: 'Failed to create card' });
    }
});

// Block/unblock card
router.patch('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['active', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Verify card belongs to user
        const result = await pool.query(
            'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Card not found' });
        }

        await pool.query(
            'UPDATE cards SET status = $1 WHERE id = $2',
            [status, req.params.id]
        );

        res.json({ message: `Card ${status} successfully` });

    } catch (error) {
        console.error('Update card status error:', error);
        res.status(500).json({ error: 'Failed to update card status' });
    }
});

module.exports = router;
