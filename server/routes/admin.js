const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    next();
};

// Helper function to log admin actions
async function logAdminAction(adminId, actionType, description, metadata = {}) {
    const id = 'action-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    await pool.query(
        `INSERT INTO admin_actions (id, admin_id, action_type, description, metadata, target_user_id, target_account_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, adminId, actionType, description, JSON.stringify(metadata), metadata.userId || null, metadata.accountId || null]
    );
}

// GET /api/admin/dashboard - Get dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = await pool.query('SELECT * FROM admin_dashboard_stats');
        
        const recentActivity = await pool.query(
            `SELECT aa.*, u.first_name, u.last_name, u.email
             FROM admin_actions aa
             JOIN users u ON aa.admin_id = u.id
             ORDER BY aa.created_at DESC
             LIMIT 10`
        );

        res.json({
            stats: stats.rows[0],
            recentActivity: recentActivity.rows
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// GET /api/admin/users - Get all users with filters
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, role, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.status,
                   u.created_at, u.last_login,
                   COUNT(DISTINCT a.id) as account_count,
                   COALESCE(SUM(a.balance), 0) as total_balance
            FROM users u
            LEFT JOIN accounts a ON u.id = a.user_id AND a.status = 'active'
            WHERE u.role != 'super_admin'
        `;
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND u.status = $${paramIndex++}`;
            params.push(status);
        }

        if (role) {
            query += ` AND u.role = $${paramIndex++}`;
            params.push(role);
        }

        if (search) {
            query += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM users WHERE role != $1';
        const countParams = ['super_admin'];
        if (status) countParams.push(status);
        if (role) countParams.push(role);
        
        const countResult = await pool.query(countQuery, countParams);

        res.json({
            users: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const userResult = await pool.query(
            `SELECT u.*, 
                    COUNT(DISTINCT a.id) as account_count,
                    COUNT(DISTINCT c.id) as card_count,
                    COUNT(DISTINCT t.id) as transaction_count
             FROM users u
             LEFT JOIN accounts a ON u.id = a.user_id
             LEFT JOIN cards c ON u.id = c.user_id
             LEFT JOIN transactions t ON a.id = t.account_id
             WHERE u.id = $1
             GROUP BY u.id`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const accounts = await pool.query(
            'SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
            [id]
        );

        const recentTransactions = await pool.query(
            `SELECT t.*, a.account_number
             FROM transactions t
             JOIN accounts a ON t.account_id = a.id
             WHERE a.user_id = $1
             ORDER BY t.created_at DESC
             LIMIT 20`,
            [id]
        );

        res.json({
            user: userResult.rows[0],
            accounts: accounts.rows,
            recentTransactions: recentTransactions.rows
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// PUT /api/admin/users/:id/status - Update user status
router.put('/users/:id/status', 
    authenticateToken, 
    requireAdmin,
    [body('status').isIn(['active', 'inactive', 'suspended'])],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const { status, reason } = req.body;

            const result = await pool.query(
                'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                [status, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            await logAdminAction(
                req.user.userId,
                'USER_STATUS_UPDATE',
                `Changed user status to ${status}`,
                { userId: id, newStatus: status, reason }
            );

            res.json({ message: 'User status updated successfully', user: result.rows[0] });
        } catch (error) {
            console.error('Update user status error:', error);
            res.status(500).json({ error: 'Failed to update user status' });
        }
    }
);

// GET /api/admin/accounts/pending - Get pending account approvals
router.get('/accounts/pending', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*, u.first_name, u.last_name, u.email
             FROM accounts a
             JOIN users u ON a.user_id = u.id
             WHERE a.approval_status = 'pending'
             ORDER BY a.created_at ASC`
        );

        res.json({ accounts: result.rows });
    } catch (error) {
        console.error('Get pending accounts error:', error);
        res.status(500).json({ error: 'Failed to fetch pending accounts' });
    }
});

// POST /api/admin/accounts/:id/approve - Approve account
router.post('/accounts/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;

        const result = await client.query(
            `UPDATE accounts 
             SET approval_status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, status = 'active'
             WHERE id = $2
             RETURNING *`,
            [req.user.userId, id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Account not found' });
        }

        await logAdminAction(
            req.user.userId,
            'ACCOUNT_APPROVED',
            `Approved account ${result.rows[0].account_number}`,
            { accountId: id, userId: result.rows[0].user_id }
        );

        await client.query('COMMIT');
        res.json({ message: 'Account approved successfully', account: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Approve account error:', error);
        res.status(500).json({ error: 'Failed to approve account' });
    } finally {
        client.release();
    }
});

// POST /api/admin/accounts/:id/reject - Reject account
router.post('/accounts/:id/reject',
    authenticateToken,
    requireAdmin,
    [body('reason').notEmpty()],
    async (req, res) => {
        const client = await pool.connect();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            await client.query('BEGIN');

            const { id } = req.params;
            const { reason } = req.body;

            const result = await client.query(
                `UPDATE accounts 
                 SET approval_status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, status = 'closed'
                 WHERE id = $2
                 RETURNING *`,
                [req.user.userId, id]
            );

            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Account not found' });
            }

            await logAdminAction(
                req.user.userId,
                'ACCOUNT_REJECTED',
                `Rejected account ${result.rows[0].account_number}: ${reason}`,
                { accountId: id, userId: result.rows[0].user_id, reason }
            );

            await client.query('COMMIT');
            res.json({ message: 'Account rejected successfully', account: result.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Reject account error:', error);
            res.status(500).json({ error: 'Failed to reject account' });
        } finally {
            client.release();
        }
    }
);

// POST /api/admin/accounts/:id/adjust-balance - Adjust account balance
router.post('/accounts/:id/adjust-balance',
    authenticateToken,
    requireAdmin,
    [
        body('amount').isFloat({ min: 0.01 }),
        body('type').isIn(['credit', 'debit']),
        body('reason').notEmpty()
    ],
    async (req, res) => {
        const client = await pool.connect();
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            await client.query('BEGIN');

            const { id } = req.params;
            const { amount, type, reason } = req.body;

            // Get current balance
            const accountResult = await client.query(
                'SELECT * FROM accounts WHERE id = $1',
                [id]
            );

            if (accountResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Account not found' });
            }

            const account = accountResult.rows[0];
            const balanceBefore = parseFloat(account.balance);
            const adjustmentAmount = parseFloat(amount);
            const balanceAfter = type === 'credit' 
                ? balanceBefore + adjustmentAmount 
                : balanceBefore - adjustmentAmount;

            if (balanceAfter < 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Insufficient balance for debit adjustment' });
            }

            // Update balance
            await client.query(
                'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [balanceAfter, id]
            );

            // Record adjustment
            const adjustmentId = 'adj-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            await client.query(
                `INSERT INTO balance_adjustments (id, account_id, admin_id, amount, adjustment_type, reason, balance_before, balance_after)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [adjustmentId, id, req.user.userId, adjustmentAmount, type, reason, balanceBefore, balanceAfter]
            );

            // Create transaction record
            const txnId = 'txn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const txnType = type === 'credit' ? 'deposit' : 'withdrawal';
            await client.query(
                `INSERT INTO transactions (id, account_id, type, amount, description, balance_after)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [txnId, id, txnType, adjustmentAmount, `Admin adjustment: ${reason}`, balanceAfter]
            );

            await logAdminAction(
                req.user.userId,
                'BALANCE_ADJUSTMENT',
                `${type === 'credit' ? 'Credited' : 'Debited'} $${adjustmentAmount.toFixed(2)} - ${reason}`,
                { accountId: id, amount: adjustmentAmount, type, reason, balanceBefore, balanceAfter }
            );

            await client.query('COMMIT');
            res.json({ 
                message: 'Balance adjusted successfully', 
                balanceBefore,
                balanceAfter,
                adjustment: adjustmentAmount
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Adjust balance error:', error);
            res.status(500).json({ error: 'Failed to adjust balance' });
        } finally {
            client.release();
        }
    }
);

// GET /api/admin/transactions - Get all transactions with filters
router.get('/transactions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type, startDate, endDate, minAmount, maxAmount, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT t.*, a.account_number, u.first_name, u.last_name, u.email
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN users u ON a.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (type) {
            query += ` AND t.type = $${paramIndex++}`;
            params.push(type);
        }

        if (startDate) {
            query += ` AND t.created_at >= $${paramIndex++}`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND t.created_at <= $${paramIndex++}`;
            params.push(endDate);
        }

        if (minAmount) {
            query += ` AND t.amount >= $${paramIndex++}`;
            params.push(minAmount);
        }

        if (maxAmount) {
            query += ` AND t.amount <= $${paramIndex++}`;
            params.push(maxAmount);
        }

        query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json({ transactions: result.rows });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// GET /api/admin/audit-log - Get admin action audit log
router.get('/audit-log', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            `SELECT aa.*, u.first_name, u.last_name, u.email
             FROM admin_actions aa
             JOIN users u ON aa.admin_id = u.id
             ORDER BY aa.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        res.json({ actions: result.rows });
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

module.exports = router;
