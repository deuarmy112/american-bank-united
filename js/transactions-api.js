/* 
 * Transactions Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    await displayUserName();
    await loadData();
});

async function loadData() {
    try {
        const [accounts, transactions] = await Promise.all([
            accountsAPI.getAll(),
            transactionsAPI.getAll()
        ]);
        
        window.accountsData = accounts;
        window.transactionsData = transactions;
        
        populateAccountFilter(accounts);
        displayTransactions(transactions);
        calculateSummary(transactions);
        
    } catch (error) {
        console.error('Failed to load data:', error);
        showAlert('Failed to load transactions', 'error');
    }
}

function populateAccountFilter(accounts) {
    const accountFilter = document.getElementById('accountFilter');
    accountFilter.innerHTML = '<option value="all">All Accounts</option>';
    
    accounts.forEach(account => {
        const option = new Option(
            `${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} - ${account.account_number}`,
            account.id
        );
        accountFilter.add(option);
    });
}

function displayTransactions(transactions) {
    const transactionsList = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p class="no-data">No transactions found</p>';
        return;
    }
    
    transactionsList.innerHTML = '';
    
    transactions.forEach(txn => {
        const txnRow = document.createElement('div');
        txnRow.className = 'transaction-row';
        
        let icon, amountClass, sign;
        
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
            <div class="txn-info">
                <p class="txn-type">${txn.type.replace('_', ' ').toUpperCase()}</p>
                <p class="txn-desc">${txn.description || 'No description'}</p>
                <p class="txn-date">${formatDate(txn.created_at)}</p>
            </div>
            <p class="txn-amount ${amountClass}">${sign}${formatCurrency(txn.amount)}</p>
        `;
        
        transactionsList.appendChild(txnRow);
    });
}

function calculateSummary(transactions) {
    let income = 0;
    let expenses = 0;
    
    transactions.forEach(txn => {
        if (txn.type === 'deposit') {
            income += parseFloat(txn.amount);
        } else if (txn.type === 'withdrawal' || txn.type === 'bill_payment') {
            expenses += parseFloat(txn.amount);
        }
    });
    
    const netChange = income - expenses;
    
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(expenses);
    document.getElementById('netChange').textContent = formatCurrency(Math.abs(netChange));
    
    const netChangeElement = document.getElementById('netChange');
    netChangeElement.className = netChange >= 0 ? 'positive' : 'negative';
}

// Filter handlers
document.getElementById('accountFilter')?.addEventListener('change', filterTransactions);
document.getElementById('typeFilter')?.addEventListener('change', filterTransactions);
document.getElementById('searchInput')?.addEventListener('input', filterTransactions);

function filterTransactions() {
    const accountId = document.getElementById('accountFilter').value;
    const type = document.getElementById('typeFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = window.transactionsData;
    
    if (accountId !== 'all') {
        filtered = filtered.filter(txn => txn.account_id === accountId);
    }
    
    if (type !== 'all') {
        filtered = filtered.filter(txn => txn.type === type);
    }
    
    if (search) {
        filtered = filtered.filter(txn => 
            txn.description?.toLowerCase().includes(search) ||
            txn.type.toLowerCase().includes(search)
        );
    }
    
    displayTransactions(filtered);
    calculateSummary(filtered);
}
