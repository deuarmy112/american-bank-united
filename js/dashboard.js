/* 
 * Dashboard Page Script
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!requireAuth()) return;
    
    // Display user info
    displayUserName();
    
    // Load dashboard data
    loadDashboardData();
});

function loadDashboardData() {
    const user = getCurrentUser();
    const accounts = getUserAccounts(user.id);
    const transactions = getUserTransactions(user.id);
    
    // Calculate total balance
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
    
    // Display account count
    document.getElementById('totalAccounts').textContent = accounts.length;
    
    // Display transaction count
    document.getElementById('totalTransactions').textContent = transactions.length;
    
    // Calculate monthly activity (transactions in current month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.createdAt);
        return txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear;
    });
    
    const monthlyAmount = monthlyTransactions.reduce((sum, txn) => {
        // Add deposits and transfers in, subtract withdrawals and transfers out
        const accountIds = accounts.map(acc => acc.id);
        if (txn.type === 'deposit' || (txn.type === 'transfer' && accountIds.includes(txn.toAccountId))) {
            return sum + txn.amount;
        }
        return sum;
    }, 0);
    
    document.getElementById('monthlyActivity').textContent = formatCurrency(monthlyAmount);
    
    // Load accounts
    loadDashboardAccounts(accounts);
    
    // Load recent transactions (last 5)
    loadRecentTransactions(transactions.slice(0, 5), accounts);
}

function loadDashboardAccounts(accounts) {
    const accountsList = document.getElementById('accountsList');
    
    if (accounts.length === 0) {
        accountsList.innerHTML = `
            <div class="card text-center">
                <p>No accounts yet. <a href="accounts.html">Create your first account</a></p>
            </div>
        `;
        return;
    }
    
    accountsList.innerHTML = accounts.map(account => `
        <div class="account-card" onclick="window.location.href='accounts.html'">
            <div class="account-header">
                <h3>${capitalize(account.account_type)} Account</h3>
                <span class="account-status">${account.status}</span>
            </div>
            <div class="account-number">Account: ${account.account_number}</div>
            <div class="account-balance">${formatCurrency(account.balance)}</div>
            ${account.interest_rate > 0 ? `<div class="account-info">Interest Rate: ${account.interest_rate}%</div>` : ''}
        </div>
    `).join('');
}

function loadRecentTransactions(transactions, accounts) {
    const container = document.getElementById('recentTransactions');
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p>No transactions yet</p>
            </div>
        `;
        return;
    }
    
    const accountIds = accounts.map(acc => acc.id);
    
    container.innerHTML = transactions.map(txn => {
        // Determine if this is a credit or debit for the user
        let isCredit = txn.type === 'deposit' || 
                      (txn.type === 'transfer' && accountIds.includes(txn.toAccountId));
        
        return `
            <div class="transaction-item ${isCredit ? 'credit' : 'debit'}">
                <div class="transaction-icon">${isCredit ? '↓' : '↑'}</div>
                <div class="transaction-details">
                    <div class="transaction-type">${capitalize(txn.type)}</div>
                    <div class="transaction-description">${txn.description || 'No description'}</div>
                    <div class="transaction-date">${formatDate(txn.createdAt)}</div>
                </div>
                <div class="transaction-amount ${isCredit ? 'credit' : 'debit'}">
                    ${isCredit ? '+' : '-'}${formatCurrency(txn.amount)}
                </div>
            </div>
        `;
    }).join('');
}
