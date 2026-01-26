/* 
 * Transactions Page Script
 */

let allTransactions = [];
let filteredTransactions = [];

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!requireAuth()) return;
    
    // Display user info
    displayUserName();
    
    // Load data
    loadTransactionsPage();
});

function loadTransactionsPage() {
    Promise.all([
        transactionsAPI.getAll(),
        accountsAPI.getAll(),
        fetch(`${API_BASE_URL}/external-transfers/external`, {
            headers: { 'Authorization': `Bearer ${apiClient.getToken()}` }
        }).then(r => r.json()).catch(() => [])
    ]).then(([transactions, accounts, externalTransfers]) => {
        // Merge transactions with external transfers
        const externalTxs = (externalTransfers || []).map(transfer => ({
            ...transfer,
            type: transfer.direction === 'outgoing' ? 'external_out' : 'external_in',
            amount: transfer.amount,
            description: `${transfer.transfer_type.toUpperCase()}: ${transfer.recipient_name || 'Unknown'} ${transfer.bank_name ? '('+transfer.bank_name+')' : ''}`,
            createdAt: transfer.created_at,
            isExternal: true
        }));
        
        allTransactions = [...transactions, ...externalTxs].sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
        filteredTransactions = [...allTransactions];
        
        // Store accounts for later use
        window.userAccounts = accounts;
        
        // Load accounts in filter dropdown
        loadAccountsFilter();
        
        // Display transactions
        displayTransactions();
        
        // Calculate summary
        calculateSummary();
    }).catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('transactionsList').innerHTML = '<p class="text-center text-slate-500 py-4">Unable to load transactions</p>';
    });
}

function loadAccountsFilter() {
    const accounts = window.userAccounts || [];
    const filterSelect = document.getElementById('filterAccount');
    
    filterSelect.innerHTML = '<option value="">All Accounts</option>';
    
    accounts.forEach(account => {
        filterSelect.innerHTML += `
            <option value="${account.id}">
                ${capitalize(account.accountType)} - ${account.accountNumber}
            </option>
        `;
    });
}

function filterTransactions() {
    const accountFilter = document.getElementById('filterAccount').value;
    const typeFilter = document.getElementById('filterType').value;
    const searchTerm = document.getElementById('searchTransaction').value.toLowerCase();
    
    filteredTransactions = allTransactions.filter(txn => {
        // Filter by account
        if (accountFilter) {
            if (txn.fromAccountId !== accountFilter && txn.toAccountId !== accountFilter) {
                return false;
            }
        }
        
        // Filter by type
        if (typeFilter && txn.type !== typeFilter) {
            return false;
        }
        
        // Filter by search term
        if (searchTerm) {
            const description = (txn.description || '').toLowerCase();
            const type = txn.type.toLowerCase();
            if (!description.includes(searchTerm) && !type.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
    
    displayTransactions();
    calculateSummary();
}

function displayTransactions() {
    const container = document.getElementById('transactionsList');
    
    if (filteredTransactions.length === 0) {
        container.innerHTML = `
            <div class="card text-center" style="padding: 40px;">
                <h3>No transactions found</h3>
                <p>Try adjusting your filters or <a href="transfer.html">make your first transfer</a></p>
            </div>
        `;
        return;
    }
    
    const accounts = window.userAccounts || [];
    const accountIds = accounts.map(acc => acc.id);
    
    container.innerHTML = filteredTransactions.map(txn => {
        // Determine if this is a credit or debit
        let isCredit = txn.type === 'deposit' || 
                      (txn.type === 'transfer' && accountIds.includes(txn.toAccountId));
        
        // Get account info
        let accountInfo = '';
        if (txn.type === 'transfer') {
            const fromAcc = accounts.find(acc => acc.id === txn.fromAccountId);
            const toAcc = accounts.find(acc => acc.id === txn.toAccountId);
            if (isCredit) {
                accountInfo = `From: ${fromAcc ? capitalize(fromAcc.accountType) + ' (' + fromAcc.accountNumber + ')' : 'External'}`;
            } else {
                accountInfo = `To: ${toAcc ? capitalize(toAcc.accountType) + ' (' + toAcc.accountNumber + ')' : 'External'}`;
            }
        } else {
            const accId = txn.fromAccountId || txn.toAccountId;
            const acc = accounts.find(acc => acc.id === accId);
            accountInfo = acc ? `${capitalize(acc.accountType)} (${acc.accountNumber})` : '';
        }
        
        return `
            <div class="transaction-item ${isCredit ? 'credit' : 'debit'}">
                <div class="transaction-icon">${isCredit ? '↓' : '↑'}</div>
                <div class="transaction-details">
                    <div class="transaction-type">${capitalize(txn.type)}</div>
                    <div class="transaction-description">${txn.description || 'No description'}</div>
                    <div class="transaction-date">${formatDate(txn.createdAt)}</div>
                    ${accountInfo ? `<div class="transaction-date">${accountInfo}</div>` : ''}
                </div>
                <div class="transaction-amount ${isCredit ? 'credit' : 'debit'}">
                    ${isCredit ? '+' : '-'}${formatCurrency(txn.amount)}
                </div>
            </div>
        `;
    }).join('');
}

function calculateSummary() {
    const accounts = window.userAccounts || [];
    const accountIds = accounts.map(acc => acc.id);
    
    let totalIncome = 0;
    let totalExpenses = 0;
    
    filteredTransactions.forEach(txn => {
        const isCredit = txn.type === 'deposit' || 
                        (txn.type === 'transfer' && accountIds.includes(txn.toAccountId));
        
        if (isCredit) {
            totalIncome += txn.amount;
        } else {
            totalExpenses += txn.amount;
        }
    });
    
    const netChange = totalIncome - totalExpenses;
    
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
    
    const netChangeElement = document.getElementById('netChange');
    netChangeElement.textContent = formatCurrency(Math.abs(netChange));
    netChangeElement.className = 'summary-amount';
    if (netChange > 0) {
        netChangeElement.classList.add('green');
    } else if (netChange < 0) {
        netChangeElement.classList.add('red');
    }
}
