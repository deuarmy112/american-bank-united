const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { generateId } = require('../utils/helpers');

// Validation rules
const externalTransferValidation = [
    body('fromAccountId').notEmpty().withMessage('Source account is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('recipientType').isIn(['user', 'external_bank']).withMessage('Invalid recipient type'),
    body('recipientIdentifier').notEmpty().withMessage('Recipient identifier is required'),
    body('description').optional().trim()
];

const transferRequestValidation = [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('fromEmail').isEmail().withMessage('Valid email is required'),
    body('toAccountId').notEmpty().withMessage('Recipient account is required'),
    body('description').optional().trim()
];

// Get all external transfers for user
router.get('/external', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                et.*,
                a.account_number,
                a.account_type,
                u.first_name,
                u.last_name,
                u.email
            FROM external_transfers et
            JOIN accounts a ON et.account_id = a.id
            JOIN users u ON a.user_id = u.id
            WHERE u.id = $1
            ORDER BY et.created_at DESC
        `, [req.user.userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching external transfers:', error);
        res.status(500).json({ error: 'Failed to fetch transfers' });
    }
});

// Send money to another user by email
router.post('/send-to-user', authenticateToken, externalTransferValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fromAccountId, recipientEmail, amount, description } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verify sender's account
        const senderAccount = await client.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2',
            [fromAccountId, req.user.userId]
        );

        if (senderAccount.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found' });
        }

        if (parseFloat(senderAccount.rows[0].balance) < parseFloat(amount)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Find recipient by email
        const recipient = await client.query(
            'SELECT u.id, u.email, u.first_name, u.last_name FROM users u WHERE u.email = $1',
            [recipientEmail]
        );

        if (recipient.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Recipient not found' });
        }

        // Get recipient's primary checking account (or first available)
        const recipientAccount = await client.query(
            'SELECT * FROM accounts WHERE user_id = $1 AND status = $2 ORDER BY CASE WHEN account_type = $3 THEN 0 ELSE 1 END LIMIT 1',
            [recipient.rows[0].id, 'active', 'checking']
        );

        if (recipientAccount.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Recipient has no active accounts' });
        }

        // Deduct from sender
        const newSenderBalance = parseFloat(senderAccount.rows[0].balance) - parseFloat(amount);
        await client.query(
            'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newSenderBalance, fromAccountId]
        );

        // Add to recipient
        const newRecipientBalance = parseFloat(recipientAccount.rows[0].balance) + parseFloat(amount);
        await client.query(
            'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newRecipientBalance, recipientAccount.rows[0].id]
        );

        // Create external transfer record
        const transferId = generateId();
        await client.query(`
            INSERT INTO external_transfers 
            (id, account_id, transfer_type, direction, amount, recipient_name, recipient_identifier, status, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        `, [
            transferId,
            fromAccountId,
            'p2p',
            'outgoing',
            amount,
            `${recipient.rows[0].first_name} ${recipient.rows[0].last_name}`,
            recipientEmail,
            'completed',
            description || `Transfer to ${recipient.rows[0].first_name}`
        ]);

        // Create incoming transfer record for recipient
        const incomingTransferId = generateId();
        await client.query(`
            INSERT INTO external_transfers 
            (id, account_id, transfer_type, direction, amount, recipient_name, recipient_identifier, status, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        `, [
            incomingTransferId,
            recipientAccount.rows[0].id,
            'p2p',
            'incoming',
            amount,
            `${senderAccount.rows[0].first_name || 'User'}`,
            req.user.email,
            'completed',
            description || 'Received money'
        ]);

        // Create transaction records
        const senderTxId = generateId();
        await client.query(`
            INSERT INTO transactions 
            (id, account_id, type, amount, description, related_account_id, balance_after, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        `, [
            senderTxId,
            fromAccountId,
            'transfer',
            -amount,
            `Sent to ${recipient.rows[0].first_name} ${recipient.rows[0].last_name}`,
            recipientAccount.rows[0].id,
            newSenderBalance
        ]);

        const recipientTxId = generateId();
        await client.query(`
            INSERT INTO transactions 
            (id, account_id, type, amount, description, related_account_id, balance_after, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        `, [
            recipientTxId,
            recipientAccount.rows[0].id,
            'deposit',
            amount,
            `Received from ${req.user.email}`,
            fromAccountId,
            newRecipientBalance
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Money sent successfully',
            transfer: {
                id: transferId,
                amount,
                recipient: recipient.rows[0],
                newBalance: newSenderBalance
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending money:', error);
        res.status(500).json({ error: 'Failed to send money' });
    } finally {
        client.release();
    }
});

// Send money to external bank account
router.post('/send-to-bank', authenticateToken, externalTransferValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fromAccountId, bankName, accountNumber, routingNumber, accountHolderName, amount, description, transferType } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verify account and balance
        const account = await client.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2',
            [fromAccountId, req.user.userId]
        );

        if (account.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found' });
        }

        if (parseFloat(account.rows[0].balance) < parseFloat(amount)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Deduct amount
        const newBalance = parseFloat(account.rows[0].balance) - parseFloat(amount);
        await client.query(
            'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newBalance, fromAccountId]
        );

        // Create external transfer record
        const transferId = generateId();
        const status = transferType === 'wire' ? 'completed' : 'pending'; // Wire is instant, ACH takes time

        await client.query(`
            INSERT INTO external_transfers 
            (id, account_id, transfer_type, direction, amount, recipient_name, recipient_identifier, bank_name, routing_number, status, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        `, [
            transferId,
            fromAccountId,
            transferType || 'ach',
            'outgoing',
            amount,
            accountHolderName,
            accountNumber,
            bankName,
            routingNumber,
            status,
            description || `Transfer to ${bankName}`
        ]);

        // Create transaction record
        const txId = generateId();
        await client.query(`
            INSERT INTO transactions 
            (id, account_id, type, amount, description, balance_after, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
            txId,
            fromAccountId,
            'withdrawal',
            -amount,
            `External transfer to ${bankName} - ${accountHolderName}`,
            newBalance
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Transfer ${status}. ${transferType === 'wire' ? 'Funds sent immediately.' : 'Processing time: 1-3 business days.'}`,
            transfer: {
                id: transferId,
                amount,
                status,
                bankName,
                accountHolderName,
                newBalance,
                estimatedArrival: transferType === 'wire' ? 'Immediate' : '1-3 business days'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending to bank:', error);
        res.status(500).json({ error: 'Failed to send money' });
    } finally {
        client.release();
    }
});

// Request money from another user
router.post('/request-money', authenticateToken, transferRequestValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { amount, fromEmail, toAccountId, description } = req.body;

    try {
        // Verify the account belongs to the requester
        const account = await pool.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2',
            [toAccountId, req.user.userId]
        );

        if (account.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Verify the payer exists
        const payer = await pool.query(
            'SELECT id, email, first_name, last_name FROM users WHERE email = $1',
            [fromEmail]
        );

        if (payer.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create transfer request
        const requestId = generateId();
        await pool.query(`
            INSERT INTO transfer_requests 
            (id, requester_user_id, requester_account_id, payer_email, amount, description, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        `, [
            requestId,
            req.user.userId,
            toAccountId,
            fromEmail,
            amount,
            description || 'Payment request',
            'pending'
        ]);

        res.json({
            success: true,
            message: 'Money request sent',
            request: {
                id: requestId,
                amount,
                payerEmail: fromEmail,
                status: 'pending'
            }
        });

    } catch (error) {
        console.error('Error requesting money:', error);
        res.status(500).json({ error: 'Failed to send request' });
    }
});

// Get all money requests (incoming and outgoing)
router.get('/requests', authenticateToken, async (req, res) => {
    try {
        // Outgoing requests (user is requesting money)
        const outgoing = await pool.query(`
            SELECT tr.*, a.account_number, a.account_type
            FROM transfer_requests tr
            JOIN accounts a ON tr.requester_account_id = a.id
            WHERE tr.requester_user_id = $1
            ORDER BY tr.created_at DESC
        `, [req.user.userId]);

        // Incoming requests (user needs to pay)
        const incoming = await pool.query(`
            SELECT 
                tr.*,
                u.first_name as requester_first_name,
                u.last_name as requester_last_name,
                u.email as requester_email
            FROM transfer_requests tr
            JOIN users u ON tr.requester_user_id = u.id
            WHERE tr.payer_email = $1
            ORDER BY tr.created_at DESC
        `, [req.user.email]);

        res.json({
            outgoing: outgoing.rows,
            incoming: incoming.rows
        });

    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Pay a money request
router.post('/requests/:requestId/pay', authenticateToken, async (req, res) => {
    const { requestId } = req.params;
    const { fromAccountId } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get the request
        const request = await client.query(
            'SELECT * FROM transfer_requests WHERE id = $1 AND payer_email = $2 AND status = $3',
            [requestId, req.user.email, 'pending']
        );

        if (request.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        // Verify payer's account
        const payerAccount = await client.query(
            'SELECT * FROM accounts WHERE id = $1 AND user_id = $2',
            [fromAccountId, req.user.userId]
        );

        if (payerAccount.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found' });
        }

        const amount = parseFloat(request.rows[0].amount);

        if (parseFloat(payerAccount.rows[0].balance) < amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Get requester's account
        const requesterAccount = await client.query(
            'SELECT * FROM accounts WHERE id = $1',
            [request.rows[0].requester_account_id]
        );

        // Deduct from payer
        const newPayerBalance = parseFloat(payerAccount.rows[0].balance) - amount;
        await client.query(
            'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newPayerBalance, fromAccountId]
        );

        // Add to requester
        const newRequesterBalance = parseFloat(requesterAccount.rows[0].balance) + amount;
        await client.query(
            'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newRequesterBalance, requesterAccount.rows[0].id]
        );

        // Update request status
        await client.query(
            'UPDATE transfer_requests SET status = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['completed', requestId]
        );

        // Create transactions
        const payerTxId = generateId();
        await client.query(`
            INSERT INTO transactions 
            (id, account_id, type, amount, description, balance_after, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
            payerTxId,
            fromAccountId,
            'transfer',
            -amount,
            `Payment request: ${request.rows[0].description}`,
            newPayerBalance
        ]);

        const requesterTxId = generateId();
        await client.query(`
            INSERT INTO transactions 
            (id, account_id, type, amount, description, balance_after, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
            requesterTxId,
            requesterAccount.rows[0].id,
            'deposit',
            amount,
            `Payment received: ${request.rows[0].description}`,
            newRequesterBalance
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Payment completed',
            newBalance: newPayerBalance
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error paying request:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    } finally {
        client.release();
    }
});

// Decline a money request
router.post('/requests/:requestId/decline', authenticateToken, async (req, res) => {
    const { requestId } = req.params;

    try {
        const result = await pool.query(
            'UPDATE transfer_requests SET status = $1 WHERE id = $2 AND payer_email = $3 AND status = $4 RETURNING *',
            ['declined', requestId, req.user.email, 'pending']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        res.json({
            success: true,
            message: 'Request declined'
        });

    } catch (error) {
        console.error('Error declining request:', error);
        res.status(500).json({ error: 'Failed to decline request' });
    }
});

module.exports = router;
