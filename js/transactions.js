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
