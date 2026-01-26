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
        if (typeFilter) {
            if (typeFilter === 'transfer' && txn.type !== 'transfer') {
                return false;
            } else if (typeFilter === 'deposit' && txn.type !== 'deposit') {
                return false;
            } else if (typeFilter === 'withdrawal' && txn.type !== 'withdrawal') {
                return false;
            } else if (typeFilter === 'external_in' && txn.type !== 'external_in') {
                return false;
            } else if (typeFilter === 'external_out' && txn.type !== 'external_out') {
                return false;
            }
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
            <div class="p-12 text-center">
                <i class="fas fa-search text-6xl text-slate-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-slate-700 mb-2">No transactions found</h3>
                <p class="text-slate-500 mb-4">Try adjusting your filters or <a href="transfer.html" class="text-blue-600 hover:text-blue-800">make your first transfer</a></p>
            </div>
        `;
        return;
    }

    const accounts = window.userAccounts || [];
    const accountIds = accounts.map(acc => acc.id);

    container.innerHTML = filteredTransactions.map(txn => {
        // Determine if this is a credit or debit
        let isCredit = txn.type === 'deposit' || txn.type === 'external_in' ||
                      (txn.type === 'transfer' && accountIds.includes(txn.toAccountId));

        // Get transaction icon and color
        let iconClass = 'fas fa-exchange-alt text-slate-600';
        let bgColor = 'bg-slate-100';
        let textColor = 'text-slate-600';

        if (txn.type === 'deposit' || txn.type === 'external_in') {
            iconClass = 'fas fa-arrow-down text-green-600';
            bgColor = 'bg-green-100';
            textColor = 'text-green-600';
        } else if (txn.type === 'withdrawal' || txn.type === 'external_out') {
            iconClass = 'fas fa-arrow-up text-red-600';
            bgColor = 'bg-red-100';
            textColor = 'text-red-600';
        } else if (txn.type === 'transfer') {
            iconClass = 'fas fa-exchange-alt text-blue-600';
            bgColor = 'bg-blue-100';
            textColor = 'text-blue-600';
        }

        // Get account info
        let accountInfo = '';
        if (txn.type === 'transfer') {
            const fromAcc = accounts.find(acc => acc.id === txn.fromAccountId);
            const toAcc = accounts.find(acc => acc.id === txn.toAccountId);
            if (isCredit) {
                accountInfo = `From: ${fromAcc ? capitalize(fromAcc.accountType) + ' (****' + fromAcc.accountNumber.slice(-4) + ')' : 'External'}`;
            } else {
                accountInfo = `To: ${toAcc ? capitalize(toAcc.accountType) + ' (****' + toAcc.accountNumber.slice(-4) + ')' : 'External'}`;
            }
        } else {
            const accId = txn.fromAccountId || txn.toAccountId;
            const acc = accounts.find(acc => acc.id === accId);
            accountInfo = acc ? `${capitalize(acc.accountType)} (****${acc.accountNumber.slice(-4)})` : '';
        }

        return `
            <div class="p-4 hover:bg-slate-50 transition-colors">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 ${bgColor} rounded-full flex items-center justify-center">
                            <i class="${iconClass} text-lg"></i>
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-slate-900">${txn.description || capitalize(txn.type)}</div>
                            <div class="text-sm text-slate-500">${formatDate(txn.createdAt || txn.created_at)}</div>
                            ${accountInfo ? `<div class="text-xs text-slate-400 mt-1">${accountInfo}</div>` : ''}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}">
                            ${isCredit ? '+' : '-'}${formatCurrency(txn.amount)}
                        </div>
                        <div class="text-xs text-slate-500 capitalize">${txn.type.replace('_', ' ')}</div>
                    </div>
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
        const isCredit = txn.type === 'deposit' || txn.type === 'external_in' ||
                        (txn.type === 'transfer' && accountIds.includes(txn.toAccountId));

        if (isCredit) {
            totalIncome += txn.amount;
        } else {
            totalExpenses += txn.amount;
        }
    });

    const netChange = totalIncome - totalExpenses;

    // Update income
    document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);

    // Update expenses
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);

    // Update net change
    const netChangeElement = document.getElementById('netChange');
    netChangeElement.textContent = (netChange >= 0 ? '+' : '') + formatCurrency(netChange);
    netChangeElement.className = 'text-2xl font-bold';
    if (netChange > 0) {
        netChangeElement.classList.add('text-green-600');
    } else if (netChange < 0) {
        netChangeElement.classList.add('text-red-600');
    } else {
        netChangeElement.classList.add('text-slate-900');
    }
}
