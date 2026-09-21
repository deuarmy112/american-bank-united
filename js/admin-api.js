// Admin API Functions
function getAdminToken() {
    return localStorage.getItem('adminAuthToken') || '';
}

async function adminRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            'Authorization': `Bearer ${getAdminToken()}`
        }
    });
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Admin API returned an invalid response (${response.status})`);
    }
    if (!response.ok) throw new Error(data.error || `Admin API request failed (${response.status})`);
    return data;
}

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

const adminAPI = {
    async getTransferRecipients() {
        return adminRequest(`${API_URL}/admin/transfer-recipients`);
    },

    async createTransfer(payload) {
        return adminRequest(`${API_URL}/admin/transfers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async getVerificationRequests() {
        return adminRequest(`${API_URL}/admin/verification-requests`);
    },

    async approveVerification(requestId) {
        return adminRequest(`${API_URL}/admin/verification-requests/${requestId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    },

    async rejectVerification(requestId, reason = '') {
        return adminRequest(`${API_URL}/admin/verification-requests/${requestId}/reject`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason })
        });
    },

    async getChatConversations() {
        return adminRequest(`${API_URL}/admin/chat`);
    },

    async sendChatMessage(conversationId, text) {
        return adminRequest(`${API_URL}/admin/chat/${encodeURIComponent(conversationId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
    },

    // Get dashboard statistics
    async getDashboard() {
        return adminRequest(`${API_URL}/admin/dashboard`);
    },

    // Get all users with filters
    async getUsers(filters = {}) {
        const params = new URLSearchParams(filters);
        return adminRequest(`${API_URL}/admin/users?${params}`);
    },

    // Get user details
    async getUserDetails(userId) {
        return adminRequest(`${API_URL}/admin/users/${userId}`);
    },

    // Update user status
    async updateUserStatus(userId, status, reason = '') {
        return adminRequest(`${API_URL}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status, reason })
        });
    },

    // Get pending accounts
    async getPendingAccounts() {
        return adminRequest(`${API_URL}/admin/accounts/pending`);
    },

    // Approve account
    async approveAccount(accountId) {
        return adminRequest(`${API_URL}/admin/accounts/${accountId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    },

    // Reject account
    async rejectAccount(accountId, reason) {
        return adminRequest(`${API_URL}/admin/accounts/${accountId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
    },

    // Adjust account balance
    async adjustBalance(accountId, amount, type, reason) {
        return adminRequest(`${API_URL}/admin/accounts/${accountId}/adjust-balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, type, reason })
        });
    },

    async getCardRequests() {
        return adminRequest(`${API_URL}/admin/card-requests`);
    },

    async approveCardRequest(requestId) {
        return adminRequest(`${API_URL}/admin/card-requests/${requestId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    },

    async rejectCardRequest(requestId, reason = '') {
        return adminRequest(`${API_URL}/admin/card-requests/${requestId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
    },

    // Get transactions with filters
    async getTransactions(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`${API_URL}/admin/transactions?${params}`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch transactions');
        return await response.json();
    },

    // Get audit log
    async getAuditLog(page = 1, limit = 50) {
        const response = await fetch(`${API_URL}/admin/audit-log?page=${page}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
        });
        if (!response.ok) throw new Error('Failed to fetch audit log');
        return await response.json();
    },

    // Get pending transactions
    async getPendingTransactions() {
        const response = await fetch(`${API_URL}/admin/transactions/pending`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
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
                'Authorization': `Bearer ${getAdminToken()}`
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
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify({ reason })
        });
        if (!response.ok) throw new Error('Failed to reject transaction');
        return await response.json();
    },

    async notifyTransaction(transactionId, channels) {
        return adminRequest(`${API_URL}/admin/transactions/${transactionId}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channels })
        });
    },

    // Get approval settings
    async getApprovalSettings() {
        const response = await fetch(`${API_URL}/admin/settings/approval-thresholds`, {
            headers: { 'Authorization': `Bearer ${getAdminToken()}` }
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
                'Authorization': `Bearer ${getAdminToken()}`
            },
            body: JSON.stringify({ settings })
        });
        if (!response.ok) throw new Error('Failed to update approval settings');
        return await response.json();
    }
};
