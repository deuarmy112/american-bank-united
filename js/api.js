// API Configuration - use environment-specific URL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://american-bank-api.onrender.com/api';

// API Client with JWT token management
const apiClient = {
    // Get token from localStorage
    getToken() {
        return localStorage.getItem('authToken');
    },

    // Set token in localStorage
    setToken(token) {
        localStorage.setItem('authToken', token);
    },

    // Remove token from localStorage
    removeToken() {
        localStorage.removeItem('authToken');
    },

    // Make authenticated request
    async request(endpoint, options = {}) {
        const token = this.getToken();
        
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        };

        // Add Authorization header if token exists
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
            
            // Handle unauthorized (expired token)
            if (response.status === 401) {
                this.removeToken();
                window.location.href = '/index.html';
                throw new Error('Session expired. Please login again.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    // Convenience methods
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },
};

// API Services
const authAPI = {
    async register(userData) {
        const response = await apiClient.post('/auth/register', userData);
        if (response.token) {
            apiClient.setToken(response.token);
        }
        return response;
    },

    async login(email, password) {
        const response = await apiClient.post('/auth/login', { email, password });
        if (response.token) {
            apiClient.setToken(response.token);
        }
        return response;
    },

    async getProfile() {
        return apiClient.get('/auth/profile');
    },

    async updateProfile(payload) {
        // payload: { first_name, last_name, email, phone, avatar }
        return apiClient.patch('/auth/profile', payload);
    },

    logout() {
        apiClient.removeToken();
        window.location.href = '/index.html';
    },
};

const accountsAPI = {
    async getAll() {
        return apiClient.get('/accounts');
    },

    async getById(accountId) {
        return apiClient.get(`/accounts/${accountId}`);
    },

    async create(payload) {
        // payload: { accountType, initialDeposit?, nickname? }
        return apiClient.post('/accounts', payload);
    },

    async getTransactions(accountId) {
        return apiClient.get(`/accounts/${accountId}/transactions`);
    },
};

const transactionsAPI = {
    async getAll() {
        return apiClient.get('/transactions');
    },

    async transfer(fromAccountId, toAccountId, amount, description) {
        return apiClient.post('/transactions/transfer', {
            fromAccountId,
            toAccountId,
            amount,
            description,
        });
    },
};

const cardsAPI = {
    async getAll() {
        return apiClient.get('/cards');
    },

    async request(cardType, linkedAccountId, design) {
        return apiClient.post('/cards', {
            cardType,
            linkedAccountId,
            design,
        });
    },

    async updateStatus(cardId, status) {
        return apiClient.patch(`/cards/${cardId}/status`, { status });
    },
};

const walletsAPI = {
    async getAll() {
        return apiClient.get('/wallets');
    },
    async linkWallet(payload) {
        // payload: { address, currency, note }
        return apiClient.post('/wallets', payload);
    },
    async send(fromWalletId, payload) {
        // payload: { toAddress, amount, memo }
        return apiClient.post(`/wallets/${fromWalletId}/send`, payload);
    },
    async getTransactions(walletId) {
        return apiClient.get(`/wallets/${walletId}/transactions`);
    }
};

const billsAPI = {
    async getBillers() {
        return apiClient.get('/bills/billers');
    },

    async addBiller(billerData) {
        return apiClient.post('/bills/billers', billerData);
    },

    async getPayments() {
        return apiClient.get('/bills/payments');
    },

    async payBill(paymentData) {
        return apiClient.post('/bills/payments', paymentData);
    },
};
