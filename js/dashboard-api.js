/* 
 * Dashboard Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    if (!requireAuth()) return;
    
    // Display user info
    await displayUserName();
    
    // Load dashboard data
    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        const [accounts, transactions] = await Promise.all([
            accountsAPI.getAll(),
            transactionsAPI.getAll()
        ]);
        
        // Calculate total balance
        const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
        document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
        
        // Display account count
        document.getElementById('totalAccounts').textContent = accounts.length;
        
        // Display transaction count
        document.getElementById('totalTransactions').textContent = transactions.length;
        
        // Calculate monthly activity (transactions in current month)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyTransactions = transactions.filter(txn => {
            const txnDate = new Date(txn.created_at);
            return txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear;
        });
        
        const monthlyAmount = monthlyTransactions.reduce((sum, txn) => {
            if (txn.type === 'deposit' || txn.type === 'transfer') {
                return sum + parseFloat(txn.amount);
            }
            return sum;
        }, 0);
        
        document.getElementById('monthlyActivity').textContent = formatCurrency(monthlyAmount);
        
        // Load accounts
        loadDashboardAccounts(accounts);
        
        // Load recent transactions (last 5)
        loadRecentTransactions(transactions.slice(0, 5));
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showAlert('Failed to load dashboard data', 'error');
    }
}

function loadDashboardAccounts(accounts) {
    const accountsList = document.getElementById('accountsList');
    
    if (accounts.length === 0) {
        accountsList.innerHTML = '<p class="no-data">No accounts yet. <a href="accounts.html">Create your first account</a></p>';
        return;
    }
    
    accountsList.innerHTML = '';
    
    accounts.forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card';
        accountCard.innerHTML = `
            <h3>${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} Account</h3>
            <p class="account-number">****${account.account_number.slice(-4)}</p>
            <p class="account-balance">${formatCurrency(account.balance)}</p>
        `;
        accountsList.appendChild(accountCard);
    });
}

function loadRecentTransactions(transactions) {
    const transactionsList = document.getElementById('recentTransactionsList');
    
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p class="no-data">No recent transactions</p>';
        return;
    }
    
    transactionsList.innerHTML = '';
    
    transactions.forEach(txn => {
        const txnRow = document.createElement('div');
        txnRow.className = 'transaction-item';
        
        let icon = '';
        let amountClass = '';
        let sign = '';
        
        switch (txn.type) {
            case 'deposit':
                icon = '<i class="fas fa-arrow-down" style="color: #10b981;"></i>';
                amountClass = 'positive';
                sign = '+';
                break;
            case 'withdrawal':
                icon = '<i class="fas fa-arrow-up" style="color: #ef4444;"></i>';
                amountClass = 'negative';
                sign = '-';
                break;
            case 'transfer':
                icon = '<i class="fas fa-exchange-alt" style="color: #3b82f6;"></i>';
                amountClass = 'negative';
                sign = '-';
                break;
            case 'bill_payment':
                icon = '<i class="fas fa-file-invoice-dollar" style="color: #f59e0b;"></i>';
                amountClass = 'negative';
                sign = '-';
                break;
        }
        
        txnRow.innerHTML = `
            <div class="txn-icon">${icon}</div>
            <div class="txn-details">
                <p class="txn-desc">${txn.description || txn.type}</p>
                <p class="txn-date">${formatDate(txn.created_at)}</p>
            </div>
            <p class="txn-amount ${amountClass}">${sign}${formatCurrency(txn.amount)}</p>
        `;
        
        transactionsList.appendChild(txnRow);
    });
}
