// Admin API Functions
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api'
    : 'https://american-bank-api.onrender.com/api';

const adminAPI = {
    // Get dashboard statistics
    async getDashboard() {
        const response = await fetch(`${API_URL}/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch dashboard');
        return await response.json();
    },

    // Get all users with filters
    async getUsers(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`${API_URL}/admin/users?${params}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        return await response.json();
    },

    // Get user details
    async getUserDetails(userId) {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch user details');
        return await response.json();
    },

    // Update user status
    async updateUserStatus(userId, status, reason = '') {
        const response = await fetch(`${API_URL}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status, reason })
        });
        if (!response.ok) throw new Error('Failed to update user status');
        return await response.json();
    },

    // Get pending accounts
    async getPendingAccounts() {
        const response = await fetch(`${API_URL}/admin/accounts/pending`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch pending accounts');
        return await response.json();
    },

    // Approve account
    async approveAccount(accountId) {
        const response = await fetch(`${API_URL}/admin/accounts/${accountId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to approve account');
        return await response.json();
    },

    // Reject account
    async rejectAccount(accountId, reason) {
        const response = await fetch(`${API_URL}/admin/accounts/${accountId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ reason })
        });
        if (!response.ok) throw new Error('Failed to reject account');
        return await response.json();
    },

    // Adjust account balance
    async adjustBalance(accountId, amount, type, reason) {
        const response = await fetch(`${API_URL}/admin/accounts/${accountId}/adjust-balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ amount, type, reason })
        });
        if (!response.ok) throw new Error('Failed to adjust balance');
        return await response.json();
    },

    // Get transactions with filters
    async getTransactions(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`${API_URL}/admin/transactions?${params}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch transactions');
        return await response.json();
    },

    // Get audit log
    async getAuditLog(page = 1, limit = 50) {
        const response = await fetch(`${API_URL}/admin/audit-log?page=${page}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch audit log');
        return await response.json();
    },

    // Get pending transactions
    async getPendingTransactions() {
        const response = await fetch(`${API_URL}/admin/transactions/pending`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch pending transactions');
        return await response.json();
    },

    // Approve transaction
    async approveTransaction(transactionId) {
        const response = await fetch(`${API_URL}/admin/transactions/${transactionId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) throw new Error('Failed to approve transaction');
        return await response.json();
    },

    // Reject transaction
    async rejectTransaction(transactionId, reason) {
        const response = await fetch(`${API_URL}/admin/transactions/${transactionId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ reason })
        });
        if (!response.ok) throw new Error('Failed to reject transaction');
        return await response.json();
    },

    // Get approval settings
    async getApprovalSettings() {
        const response = await fetch(`${API_URL}/admin/settings/approval-thresholds`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch approval settings');
        return await response.json();
    },

    // Update approval settings
    async updateApprovalSettings(settings) {
        const response = await fetch(`${API_URL}/admin/settings/approval-thresholds`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ settings })
        });
        if (!response.ok) throw new Error('Failed to update approval settings');
        return await response.json();
    }
};
