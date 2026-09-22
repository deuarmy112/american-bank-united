/* 
 * Transactions Page Script
    document.body.classList.add('abu-overlay-open');
    const closeDetails = () => {
        overlay.remove();
        document.body.classList.remove('abu-overlay-open');
    };
 */
        if (event.target === overlay) closeDetails();
let allTransactions = [];
    overlay.querySelectorAll('.close-transaction-detail').forEach(button => button.addEventListener('click', closeDetails));

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
        allTransactions = mergeTransactionsWithReceipts(transactions, externalTransfers);
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

function mergeTransactionsWithReceipts(transactions, externalTransfers) {
    const externalTxs = (externalTransfers || []).map(transfer => ({
        ...transfer,
        type: transfer.direction === 'outgoing' ? 'external_out' : 'external_in',
        amount: transfer.amount,
        description: `${String(transfer.transfer_type || 'external').toUpperCase()}: ${transfer.recipient_name || 'Unknown'} ${transfer.bank_name ? '(' + transfer.bank_name + ')' : ''}`,
        createdAt: transfer.created_at,
        account_id: transfer.account_id,
        isExternal: true
    }));
    const merged = new Map();

    (transactions || []).forEach((transaction, index) => {
        const receiptId = transaction.receipt_id || transaction.receiptId;
        merged.set(receiptId ? `receipt:${receiptId}` : `transaction:${transaction.id || index}`, transaction);
    });

    externalTxs.forEach((transfer, index) => {
        const receiptId = transfer.receipt_id || transfer.receiptId;
        const key = receiptId ? `receipt:${receiptId}` : `external:${transfer.id || index}`;
        // External records contain the beneficiary and bank fields used by receipt details.
        merged.set(key, transfer);
    });

    return [...merged.values()].sort((a, b) =>
        new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
    );
}
    document.body.classList.add('abu-overlay-open');
    const closeReceipt = () => {
        overlay.remove();
        document.body.classList.remove('abu-overlay-open');
    };
    overlay.querySelectorAll('.close-receipt').forEach(button => button.addEventListener('click', closeReceipt));
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeReceipt();
    });
function loadAccountsFilter() {
    const accounts = window.userAccounts || [];
    const filterSelect = document.getElementById('filterAccount');
    
    filterSelect.innerHTML = '<option value="">All Accounts</option>';
    
    accounts.forEach(account => {
        const accountType = account.account_type || account.accountType || 'Account';
        const accountNumber = account.account_number || account.accountNumber || '';
        filterSelect.innerHTML += `
            <option value="${account.id}">
                ${capitalize(accountType)} - ${accountNumber ? `****${accountNumber.slice(-4)}` : 'Unavailable'}
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
            if (txn.account_id !== accountFilter && txn.fromAccountId !== accountFilter && txn.toAccountId !== accountFilter) {
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

    container.innerHTML = filteredTransactions.map((txn, index) => {
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
            const accId = txn.account_id || txn.fromAccountId || txn.toAccountId;
            const acc = accounts.find(account => account.id === accId);
            const accountType = acc?.account_type || acc?.accountType;
            const accountNumber = acc?.account_number || acc?.accountNumber;
            accountInfo = acc ? `${capitalize(accountType)} (****${accountNumber.slice(-4)})` : '';
        }

        return `
            <div class="transaction-row p-4 hover:bg-slate-50 transition-colors cursor-pointer" role="button" tabindex="0" data-detail-index="${index}">
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
                            ${isCredit ? '+' : '-'}${formatCurrency(Math.abs(Number(txn.amount) || 0))}
                        </div>
                        <div class="text-xs text-slate-500 capitalize">${txn.type.replace('_', ' ')}</div>
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

function showTransactionDetails(transaction) {
    if (!transaction) return;
    const receiptId = transaction.receipt_id || transaction.receiptId || `TXN-${transaction.id || Date.now()}`;
    const date = formatDate(transaction.createdAt || transaction.created_at);
    const type = String(transaction.type || 'transaction').replace(/_/g, ' ');
    const amount = formatCurrency(Math.abs(Number(transaction.amount) || 0));
    const status = transaction.status || transaction.approval_status || 'completed';
    const destination = transaction.recipient_name || transaction.wallet_platform || transaction.bank_name || transaction.recipient_identifier || '';
    const overlay = document.createElement('div');
    overlay.className = 'transaction-detail-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';
    overlay.innerHTML = `
        <section class="transaction-detail-sheet bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 max-h-[85vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Transaction details">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <p class="text-xs uppercase tracking-wide text-slate-500">Transaction details</p>
                    <h2 class="text-xl font-semibold text-slate-900 mt-1">${type}</h2>
                </div>
                <button type="button" class="close-transaction-detail text-slate-500 text-2xl" aria-label="Close">&times;</button>
            </div>
            <div class="rounded-xl bg-slate-50 p-4 mb-5 text-center">
                <div class="text-xs text-slate-500">Amount</div>
                <div class="text-3xl font-bold ${Number(transaction.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${Number(transaction.amount) >= 0 ? '+' : '-'}${amount}</div>
                <div class="inline-flex mt-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs capitalize">${status}</div>
            </div>
            <dl class="divide-y divide-slate-100 text-sm">
                <div class="flex justify-between gap-4 py-3"><dt class="text-slate-500">Receipt</dt><dd class="font-medium text-right">${receiptId}</dd></div>
                <div class="flex justify-between gap-4 py-3"><dt class="text-slate-500">Date</dt><dd class="text-right">${date}</dd></div>
                <div class="flex justify-between gap-4 py-3"><dt class="text-slate-500">Description</dt><dd class="text-right">${transaction.description || 'Account activity'}</dd></div>
                ${destination ? `<div class="flex justify-between gap-4 py-3"><dt class="text-slate-500">Destination</dt><dd class="text-right">${destination}</dd></div>` : ''}
            </dl>
            <button type="button" class="close-transaction-detail mt-6 w-full border border-slate-300 rounded-lg py-3 text-sm font-medium">Close</button>
        </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.remove();
    });
    overlay.querySelectorAll('.close-transaction-detail').forEach(button => button.addEventListener('click', () => overlay.remove()));
}

function buildHistoryReceiptMarkup(receipt, transaction, values) {
    const { receiptId, date, amount, amountValue, recipientName, recipientBank, recipientAccount, recipientSwift, receiptKind, direction, account, accountType, accountNumber } = values;
    if (receipt.type === 'International Transfer') {
        return `
            <div class="international-receipt -m-4 p-4 sm:p-5 text-xs">
                <div class="receipt-brand flex items-start justify-between gap-4"><img src="assets/abu-logo.png" alt="American Bank United"><div class="text-right"><div class="font-bold text-slate-900">INTERNATIONAL TRANSFER</div><div class="text-slate-500 mt-1">Status: Submitted</div></div></div>
                <div class="grid grid-cols-2 gap-4 py-3 border-b border-slate-300"><div><div class="text-slate-500">Current date</div><strong>${receipt.date || date}</strong></div><div class="text-right"><div class="text-slate-500">Transaction number</div><strong>${receipt.reference || receiptId}</strong></div></div>
                <div class="mt-4"><div class="receipt-section-title">Ordering institution</div><div class="receipt-row"><span>Account holder</span><strong>${receipt.senderName || 'Account holder'}</strong></div><div class="receipt-row"><span>Bank name</span><strong>${receipt.senderBankName || 'American Bank United'}</strong></div><div class="receipt-row"><span>SWIFT / BIC</span><strong>${receipt.senderSwift || 'ABUUS768'}</strong></div><div class="receipt-row"><span>Debit account</span><strong>${receipt.senderAccountNumber || receipt.from || 'Not available'}</strong></div><div class="receipt-row"><span>Sender phone</span><span>${receipt.senderPhone || 'Not provided'}</span></div><div class="receipt-row"><span>Send advice by e-mail</span><span>${receipt.senderEmail || 'Not provided'}</span></div></div>
                <div class="mt-4"><div class="receipt-section-title">Beneficiary details</div><div class="receipt-row"><span>Beneficiary name</span><strong>${receipt.to || recipientName}</strong></div><div class="receipt-row"><span>Account number / IBAN</span><strong>${receipt.accountNumber || recipientAccount}</strong></div><div class="receipt-row"><span>Bank name</span><span>${receipt.bank || recipientBank}</span></div><div class="receipt-row"><span>Country</span><span>${receipt.country || 'Not provided'}</span></div><div class="receipt-row"><span>SWIFT / BIC</span><strong>${receipt.swift || recipientSwift || 'Not provided'}</strong></div><div class="receipt-row"><span>Recipient e-mail</span><span>${receipt.email || 'Not provided'}</span></div><div class="receipt-row"><span>Recipient phone</span><span>${receipt.phone || 'Not provided'}</span></div></div>
                <div class="mt-4"><div class="receipt-section-title">Transfer details</div><div class="receipt-row"><span>Transfer type</span><span>International bank transfer</span></div><div class="receipt-row"><span>Value date</span><span>${String(receipt.date || date).split(',')[0]}</span></div><div class="receipt-row"><span>Transfer information</span><span>${receipt.description || 'International transfer'}</span></div></div>
                <div class="mt-4"><div class="receipt-section-title">Charges</div><div class="receipt-row"><span>Conversion fee (5%)</span><strong>$${receipt.fee || '0.00'} USD</strong></div><div class="receipt-total mt-2"><div class="receipt-row"><span>Amount sent</span><strong>$${Number(receipt.amountSent ?? amountValue).toFixed(2)} USD</strong></div><div class="receipt-row"><span>Amount received</span><strong>${receipt.currencySymbol || ''}${receipt.convertedAmount || amount} ${receipt.currency || 'USD'}</strong></div></div></div>
                <div class="receipt-disclaimer mt-5 pt-3">This electronic receipt confirms that the transfer instruction was submitted through American Bank United. Final execution timing and any additional intermediary-bank charges may vary. Keep the transaction number for your records.</div>
            </div>`;
    }

    const isBankTransfer = receipt.type === 'External Transfer';
    return `
        <div class="compact-abu-receipt -m-4 p-4 sm:p-5 text-xs">
            <div class="receipt-brand flex items-center gap-3 pb-4"><img src="assets/abu-logo.png" alt="American Bank United"><div class="ml-auto text-right"><div class="text-slate-500">${isBankTransfer ? 'BANK TRANSFER' : 'ABU ACCOUNT TRANSFER'}</div><div class="font-bold text-slate-900">Status: Successful</div></div></div>
            <div class="text-center py-4 receipt-dashed"><div class="receipt-amount">$${Number(amountValue).toFixed(2)}</div><div class="receipt-success mt-1">Successful Transaction</div><div class="text-slate-400 mt-1">${receipt.date || date}</div></div>
            <div class="receipt-dashed pt-4 mt-2"><div class="receipt-section-title">Recipient</div><div class="receipt-row"><span>Name</span><strong>${receipt.recipientName || recipientName}</strong></div><div class="receipt-row"><span>Bank</span><strong>${receipt.recipientBank || receipt.bank || recipientBank}</strong></div><div class="receipt-row"><span>Account number</span><strong>${receipt.recipientAccountNumber || recipientAccount}</strong></div>${isBankTransfer ? `<div class="receipt-row"><span>SWIFT / routing code</span><strong>${receipt.swift || recipientSwift}</strong></div><div class="receipt-row"><span>E-mail</span><span>${receipt.email || 'Not provided'}</span></div><div class="receipt-row"><span>Phone</span><span>${receipt.phone || 'Not provided'}</span></div>` : ''}</div>
            <div class="receipt-dashed pt-4 mt-4"><div class="receipt-section-title">Sender</div><div class="receipt-row"><span>Name</span><strong>${receipt.senderName || 'Account holder'}</strong></div><div class="receipt-row"><span>American Bank United account</span><strong>${receipt.senderAccountNumber || (account ? `${capitalize(accountType)} ****${accountNumber.slice(-4)}` : 'Account activity')}</strong></div><div class="receipt-row"><span>SWIFT / BIC</span><strong>ABUUS768</strong></div><div class="receipt-row"><span>Phone</span><span>${receipt.senderPhone || 'Not provided'}</span></div></div>
            <div class="receipt-dashed pt-4 mt-4"><div class="receipt-section-title">Transaction information</div><div class="receipt-row"><span>Transaction type</span><strong>${isBankTransfer ? 'Bank transfer' : receipt.type}</strong></div><div class="receipt-row"><span>Transaction ID</span><strong>${receipt.reference || receiptId}</strong></div><div class="receipt-row"><span>Amount</span><strong>$${Number(amountValue).toFixed(2)} USD</strong></div><div class="receipt-row"><span>Fees</span><strong>$${Number(receipt.fee || 0).toFixed(2)} USD</strong></div>${(receipt.description || transaction.description) ? `<div class="receipt-row"><span>Purpose</span><span>${receipt.description || transaction.description}</span></div>` : ''}</div>
            <div class="receipt-disclaimer mt-5 pt-3">This electronic receipt confirms the transaction recorded by American Bank United. Keep the transaction ID for your records.</div>
        </div>`;
}

function showTransactionReceipt(transaction) {
    if (!transaction) return;
    const savedReceipt = transaction.receipt_data || transaction.receiptData || null;
    const receipt = savedReceipt || transaction;
    const receiptId = receipt.reference || transaction.receipt_id || transaction.receiptId || `TXN-${transaction.id || Date.now()}`;
    const date = formatDate(receipt.date || transaction.createdAt || transaction.created_at);
    const type = String(receipt.type || transaction.type || 'transaction').replace(/_/g, ' ');
    const amountValue = Number(receipt.amount ?? receipt.amountSent ?? transaction.amount) || 0;
    const amount = formatCurrency(Math.abs(amountValue));
    const status = transaction.status || transaction.approval_status || 'completed';
    const account = (window.userAccounts || []).find(item => item.id === transaction.account_id);
    const accountType = account?.account_type || account?.accountType || '';
    const accountNumber = account?.account_number || account?.accountNumber || '';
    const destination = receipt.recipientName || receipt.to || transaction.recipient_name || transaction.wallet_platform || transaction.bank_name || transaction.recipient_identifier || 'Account activity';
    const direction = amountValue >= 0 ? 'Credit' : 'Debit';
    const recipientName = receipt.recipientName || receipt.to || transaction.recipient_name || destination;
    const recipientBank = receipt.recipientBank || receipt.bank || transaction.bank_name || (transaction.isExternal ? 'External bank' : 'American Bank United');
    const recipientAccount = receipt.recipientAccountNumber || receipt.accountNumber || transaction.recipient_identifier || transaction.recipient_account_number || 'Not available';
    const recipientSwift = receipt.swift || transaction.swift || transaction.routing_number || '';
    const isExternal = Boolean(receipt.type === 'External Transfer' || receipt.type === 'International Transfer' || transaction.isExternal || transaction.type === 'external_out' || transaction.type === 'external_in');
    const receiptKind = isExternal ? 'Bank transfer' : type;
    const receiptMarkup = buildHistoryReceiptMarkup(receipt, transaction, { receiptId, date, amount, amountValue, recipientName, recipientBank, recipientAccount, recipientSwift, receiptKind, direction, account, accountType, accountNumber });
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 pb-28 overflow-y-auto';
    overlay.innerHTML = `
        <div class="receipt-modal bg-slate-100 rounded-xl shadow-xl w-full max-w-2xl max-h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
            <div class="receipt-paper bg-white m-3 overflow-y-auto flex-1 min-h-0 pb-8">${receiptMarkup}</div>
            <div class="flex gap-3 px-3 pb-3 pt-2 shrink-0 bg-white sticky bottom-0">
                <button type="button" class="print-receipt flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-medium"><i class="fas fa-print mr-2"></i>Print</button>
                <button type="button" class="close-receipt flex-1 border border-slate-300 bg-white rounded-lg py-2 text-sm font-medium">Done</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.close-receipt').forEach(button => button.addEventListener('click', () => overlay.remove()));
    overlay.querySelector('.print-receipt').addEventListener('click', () => {
        const paper = overlay.querySelector('.receipt-paper');
        const printWindow = window.open('', '_blank', 'width=720,height=900');
        if (!printWindow) return;
        const receiptStyles = Array.from(document.querySelectorAll('style'))
            .map(style => style.textContent)
            .filter(style => style.includes('compact-abu-receipt') || style.includes('international-receipt'))
            .join('\n');
        printWindow.document.write(`<!doctype html><html><head><title>Receipt ${receiptId}</title><link rel="stylesheet" href="css/tailwind.css"><style>${receiptStyles}body{margin:0;padding:20px;background:#fff}.receipt-paper{max-width:720px;margin:0 auto;overflow-wrap:anywhere}@media print{body{padding:0}}</style></head><body>${paper.outerHTML}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    });
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
            totalIncome += Math.abs(Number(txn.amount) || 0);
        } else {
            totalExpenses += Math.abs(Number(txn.amount) || 0);
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
    netChangeElement.classList.remove('text-green-600', 'text-red-600', 'text-slate-900');
    if (netChange > 0) {
        netChangeElement.classList.add('text-green-600');
    } else if (netChange < 0) {
        netChangeElement.classList.add('text-red-600');
    } else {
        netChangeElement.classList.add('text-slate-900');
    }
}
