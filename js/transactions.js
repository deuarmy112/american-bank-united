let allTransactions = [];
let filteredTransactions = [];

document.addEventListener('DOMContentLoaded', function() {
    if (!requireAuth()) return;

    displayUserName();
    loadTransactionsPage();
});

function loadTransactionsPage() {
    Promise.all([
        transactionsAPI.getAll(),
        accountsAPI.getAll(),
        fetch(`${API_BASE_URL}/external-transfers/external`, {
            headers: { Authorization: `Bearer ${apiClient.getToken()}` }
        }).then(async response => {
            const text = await response.text();
            if (!response.ok) return [];
            try {
                const data = JSON.parse(text);
                return Array.isArray(data) ? data : [];
            } catch (error) {
                console.warn('External transfers response was not valid JSON', error);
                return [];
            }
        }).catch(() => [])
    ]).then(([transactions, accounts, externalTransfers]) => {
        allTransactions = mergeTransactionsWithReceipts(transactions, externalTransfers);
        filteredTransactions = [...allTransactions];
        window.userAccounts = Array.isArray(accounts) ? accounts : [];

        loadAccountsFilter();
        displayTransactions();
        calculateSummary();
    }).catch(error => {
        console.error('Error loading data:', error);
        const container = document.getElementById('transactionsList');
        if (container) {
            container.innerHTML = '<p class="text-center text-slate-500 py-4">Unable to load transactions</p>';
        }
    });
}

function mergeTransactionsWithReceipts(transactions, externalTransfers) {
    const transactionList = Array.isArray(transactions) ? transactions : [];
    const externalList = Array.isArray(externalTransfers) ? externalTransfers : [];

    const externalTxs = externalList.map((transfer, index) => ({
        ...transfer,
        type: transfer.direction === 'outgoing' ? 'external_out' : 'external_in',
        amount: transfer.amount,
        description: `${String(transfer.transfer_type || 'external').toUpperCase()}: ${transfer.recipient_name || 'Unknown'}${transfer.bank_name ? ` (${transfer.bank_name})` : ''}`,
        createdAt: transfer.created_at,
        account_id: transfer.account_id,
        isExternal: true,
        id: transfer.id || `external-${index}`
    }));

    const merged = new Map();
    transactionList.forEach((transaction, index) => {
        const receiptId = transaction.receipt_id || transaction.receiptId;
        const key = receiptId ? `receipt:${receiptId}` : `transaction:${transaction.id || index}`;
        merged.set(key, transaction);
    });

    externalTxs.forEach((transfer, index) => {
        const receiptId = transfer.receipt_id || transfer.receiptId;
        const key = receiptId ? `receipt:${receiptId}` : `external:${transfer.id || index}`;
        merged.set(key, transfer);
    });

    return [...merged.values()].sort((a, b) =>
        new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
    );
}

function loadAccountsFilter() {
    const accounts = window.userAccounts || [];
    const filterSelect = document.getElementById('filterAccount');
    if (!filterSelect) return;

    filterSelect.innerHTML = '<option value="">All Accounts</option>';

    accounts.forEach(account => {
        const accountType = account.account_type || account.accountType || 'Account';
        const accountNumber = account.account_number || account.accountNumber || '';
        const safeType = capitalize(String(accountType));
        const label = accountNumber ? `${safeType} - ****${String(accountNumber).slice(-4)}` : `${safeType} - Unavailable`;
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = label;
        filterSelect.appendChild(option);
    });
}

function filterTransactions() {
    const accountFilter = document.getElementById('filterAccount')?.value || '';
    const typeFilter = document.getElementById('filterType')?.value || '';
    const searchTerm = (document.getElementById('searchTransaction')?.value || '').trim().toLowerCase();

    filteredTransactions = allTransactions.filter(txn => {
        if (accountFilter) {
            const accountId = String(txn.account_id || '');
            const fromAccountId = String(txn.fromAccountId || '');
            const toAccountId = String(txn.toAccountId || '');
            if (accountId !== accountFilter && fromAccountId !== accountFilter && toAccountId !== accountFilter) {
                return false;
            }
        }

        if (typeFilter) {
            const type = txn.type || '';
            if (typeFilter === 'transfer' && type !== 'transfer') return false;
            if (typeFilter === 'deposit' && type !== 'deposit') return false;
            if (typeFilter === 'withdrawal' && type !== 'withdrawal') return false;
            if (typeFilter === 'external_in' && type !== 'external_in') return false;
            if (typeFilter === 'external_out' && type !== 'external_out') return false;
        }

        if (searchTerm) {
            const description = String(txn.description || '').toLowerCase();
            const type = String(txn.type || '').toLowerCase();
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
    if (!container) return;

    if (!filteredTransactions.length) {
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
    const accountIds = accounts.map(acc => String(acc.id));

    container.innerHTML = filteredTransactions.map((txn, index) => {
        const type = String(txn.type || 'transfer');
        const isCredit = type === 'deposit' || type === 'external_in' || (type === 'transfer' && accountIds.includes(String(txn.toAccountId || '')));

        let iconClass = 'fas fa-exchange-alt text-slate-600';
        let bgColor = 'bg-slate-100';
        let amountClass = 'text-red-600';

        if (type === 'deposit' || type === 'external_in') {
            iconClass = 'fas fa-arrow-down text-green-600';
            bgColor = 'bg-green-100';
            amountClass = 'text-green-600';
        } else if (type === 'withdrawal' || type === 'external_out') {
            iconClass = 'fas fa-arrow-up text-red-600';
            bgColor = 'bg-red-100';
            amountClass = 'text-red-600';
        } else if (type === 'transfer') {
            iconClass = 'fas fa-exchange-alt text-blue-600';
            bgColor = 'bg-blue-100';
            amountClass = 'text-blue-600';
        }

        let accountInfo = '';
        if (type === 'transfer') {
            const fromAcc = accounts.find(acc => String(acc.id) === String(txn.fromAccountId || ''));
            const toAcc = accounts.find(acc => String(acc.id) === String(txn.toAccountId || ''));
            if (isCredit) {
                const fromLabel = fromAcc ? `${capitalize(String(fromAcc.account_type || fromAcc.accountType || 'Account'))} (****${String(fromAcc.account_number || fromAcc.accountNumber || '').slice(-4) || '0000'})` : 'External';
                accountInfo = `From: ${fromLabel}`;
            } else {
                const toLabel = toAcc ? `${capitalize(String(toAcc.account_type || toAcc.accountType || 'Account'))} (****${String(toAcc.account_number || toAcc.accountNumber || '').slice(-4) || '0000'})` : 'External';
                accountInfo = `To: ${toLabel}`;
            }
        } else {
            const accId = txn.account_id || txn.fromAccountId || txn.toAccountId;
            const acc = accounts.find(account => String(account.id) === String(accId || ''));
            const accountType = acc ? (acc.account_type || acc.accountType || 'Account') : '';
            const accountNumber = acc ? (acc.account_number || acc.accountNumber || '') : '';
            accountInfo = acc ? `${capitalize(String(accountType))} (****${String(accountNumber).slice(-4) || '0000'})` : '';
        }

        const amount = Math.abs(Number(txn.amount) || 0);
        const labelText = type.replace('_', ' ');

        return `
            <div class="transaction-row p-4 hover:bg-slate-50 transition-colors cursor-pointer" role="button" tabindex="0" data-detail-index="${index}">
                <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-4 min-w-0 flex-1">
                        <div class="w-12 h-12 ${bgColor} rounded-full flex items-center justify-center shrink-0">
                            <i class="${iconClass} text-lg"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="font-medium text-slate-900 truncate">${txn.description || capitalize(type)}</div>
                            <div class="text-sm text-slate-500">${formatDate(txn.createdAt || txn.created_at)}</div>
                            ${accountInfo ? `<div class="text-xs text-slate-400 mt-1">${accountInfo}</div>` : ''}
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-lg font-semibold ${isCredit ? 'text-green-600' : amountClass}">
                            ${isCredit ? '+' : '-'}${formatCurrency(amount)}
                        </div>
                        <div class="text-xs text-slate-500 capitalize">${labelText}</div>
                        <button type="button" data-receipt-index="${index}" class="receipt-button mt-2 text-xs text-blue-600 hover:text-blue-800">Receipt</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.transaction-row').forEach(row => {
        const openReceipt = () => showTransactionReceipt(filteredTransactions[Number(row.dataset.detailIndex)]);
        row.addEventListener('click', event => {
            if (!event.target.closest('.receipt-button')) openReceipt();
        });
        row.addEventListener('keydown', event => {
            if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.receipt-button')) {
                event.preventDefault();
                openReceipt();
            }
        });
    });

    container.querySelectorAll('.receipt-button').forEach(button => {
        button.addEventListener('click', () => showTransactionReceipt(filteredTransactions[Number(button.dataset.receiptIndex)]));
    });
}

function showTransactionReceipt(transaction) {
    if (!transaction) return;

    const receipt = transaction.receipt_data || transaction.receiptData || transaction;
    const receiptId = receipt.reference || transaction.receipt_id || transaction.receiptId || `TXN-${transaction.id || Date.now()}`;
    const date = formatDate(receipt.date || transaction.createdAt || transaction.created_at);
    const amount = Math.abs(Number(receipt.amount ?? receipt.amountSent ?? transaction.amount) || 0);
    const destination = receipt.recipientName || receipt.to || transaction.recipient_name || transaction.wallet_platform || transaction.bank_name || transaction.recipient_identifier || 'Account activity';
    const account = (window.userAccounts || []).find(item => String(item.id) === String(transaction.account_id || ''));

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 pb-28 overflow-y-auto';
    overlay.innerHTML = `
        <div class="receipt-modal bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
            <div class="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div>
                    <div class="text-xs uppercase tracking-wide text-slate-300">Transaction receipt</div>
                    <div class="font-semibold">${receiptId}</div>
                </div>
                <button type="button" class="close-receipt text-white text-xl leading-none">&times;</button>
            </div>
            <div class="p-5 space-y-4">
                <div class="text-center">
                    <div class="text-xs uppercase tracking-wide text-slate-500">Amount</div>
                    <div class="text-3xl font-bold text-slate-900 mt-2">${formatCurrency(amount)}</div>
                </div>
                <div class="grid gap-2 text-sm text-slate-700">
                    <div class="flex justify-between gap-4"><span class="text-slate-500">Date</span><span>${date}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-slate-500">Type</span><span class="capitalize">${String(transaction.type || 'transaction').replace('_', ' ')}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-slate-500">Description</span><span class="text-right">${transaction.description || 'Account activity'}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-slate-500">Recipient</span><span class="text-right">${destination}</span></div>
                    <div class="flex justify-between gap-4"><span class="text-slate-500">Account</span><span class="text-right">${account ? `${capitalize(String(account.account_type || account.accountType || 'Account'))} ****${String(account.account_number || account.accountNumber || '').slice(-4) || '0000'}` : 'N/A'}</span></div>
                </div>
            </div>
            <div class="flex gap-3 px-5 pb-5 pt-2 border-t border-slate-200 bg-slate-50">
                <button type="button" class="close-receipt flex-1 border border-slate-300 bg-white rounded-lg py-2 text-sm font-medium">Done</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelectorAll('.close-receipt').forEach(button => button.addEventListener('click', () => overlay.remove()));
}

function calculateSummary() {
    const accounts = window.userAccounts || [];
    const accountIds = accounts.map(acc => String(acc.id));
    let totalIncome = 0;
    let totalExpenses = 0;

    filteredTransactions.forEach(txn => {
        const type = String(txn.type || '');
        const isCredit = type === 'deposit' || type === 'external_in' || (type === 'transfer' && accountIds.includes(String(txn.toAccountId || '')));

        if (isCredit) {
            totalIncome += Math.abs(Number(txn.amount) || 0);
        } else {
            totalExpenses += Math.abs(Number(txn.amount) || 0);
        }
    });

    const totalIncomeElement = document.getElementById('totalIncome');
    const totalExpensesElement = document.getElementById('totalExpenses');
    const netChangeElement = document.getElementById('netChange');
    if (!totalIncomeElement || !totalExpensesElement || !netChangeElement) return;

    const netChange = totalIncome - totalExpenses;
    totalIncomeElement.textContent = formatCurrency(totalIncome);
    totalExpensesElement.textContent = formatCurrency(totalExpenses);
    netChangeElement.textContent = `${netChange >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netChange))}`;
    netChangeElement.classList.remove('text-green-600', 'text-red-600', 'text-slate-900');
    if (netChange > 0) {
        netChangeElement.classList.add('text-green-600');
    } else if (netChange < 0) {
        netChangeElement.classList.add('text-red-600');
    } else {
        netChangeElement.classList.add('text-slate-900');
    }
}
