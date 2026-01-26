/* 
 * Utility Functions
 * This file contains helper functions used throughout the app
 */

// Format currency (converts number to dollar format)
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Format date to readable format
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Generate unique ID
function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Generate account number
function generateAccountNumber() {
    return 'ABU' + Date.now().toString() + Math.floor(Math.random() * 1000);
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alert');
    if (!alertDiv) return;
    
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

// Hide alert
function hideAlert() {
    const alertDiv = document.getElementById('alert');
    if (alertDiv) {
        alertDiv.style.display = 'none';
    }
}

// Capitalize first letter
function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Validate email
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Calculate age from date of birth
function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

// Simple toast notification
function showToast(message, timeout = 3500) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'fixed left-1/2 -translate-x-1/2 bottom-8 bg-slate-800 text-white px-4 py-2 rounded shadow-lg z-50 opacity-0 transition-opacity';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, timeout);
}

// Render recent transactions in a container
function renderRecentTransactions(transactions, containerEl) {
    if (!containerEl) return;

    if (!transactions || transactions.length === 0) {
        containerEl.innerHTML = '<p class="text-center text-slate-500 py-4">No transactions yet</p>';
        return;
    }

    containerEl.innerHTML = transactions.slice(0, 5).map(txn => {
        const isCredit = txn.type === 'deposit' || txn.type === 'credit';
        const amountClass = isCredit ? 'text-green-600' : 'text-red-600';
        const amountPrefix = isCredit ? '+' : '-';

        return `
            <div class="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <i class="fas ${getTransactionIcon(txn.type)} text-slate-600"></i>
                    </div>
                    <div>
                        <div class="text-sm font-medium">${txn.description || capitalize(txn.type)}</div>
                        <div class="text-xs text-slate-500">${formatDate(txn.createdAt)}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-medium ${amountClass}">${amountPrefix}${formatCurrency(txn.amount)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper function for transaction icons
function getTransactionIcon(type) {
    switch (type) {
        case 'transfer': return 'fa-exchange-alt';
        case 'deposit': return 'fa-arrow-down';
        case 'withdrawal': return 'fa-arrow-up';
        case 'payment': return 'fa-credit-card';
        default: return 'fa-circle';
    }
}
