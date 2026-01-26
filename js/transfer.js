/* 
 * Transfer Page Script
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!requireAuth()) return;
    
    // Display user info
    displayUserName();
    
    // Load accounts in dropdowns
    loadAccountsInDropdowns();
    
    // Load recent transfers
    loadRecentTransfers();
    
    // Handle account selection changes
    document.getElementById('fromAccount').addEventListener('change', updateFromBalance);
    document.getElementById('toAccount').addEventListener('change', updateToBalance);
    
    // Handle transfer form submission
    const transferForm = document.getElementById('transferForm');
    transferForm.addEventListener('submit', handleTransfer);
});

function loadAccountsInDropdowns() {
    const user = getCurrentUser();
    const accounts = getUserAccounts(user.id);
    
    const fromSelect = document.getElementById('fromAccount');
    const toSelect = document.getElementById('toAccount');
    
    // Clear existing options except the first one
    fromSelect.innerHTML = '<option value="">Select source account</option>';
    toSelect.innerHTML = '<option value="">Select destination account</option>';
    
    // Add accounts to dropdowns
    accounts.forEach(account => {
        const option = `
            <option value="${account.id}">
                ${capitalize(account.accountType)} - ${account.accountNumber} (${formatCurrency(account.balance)})
            </option>
        `;
        fromSelect.innerHTML += option;
        toSelect.innerHTML += option;
    });
    
    if (accounts.length === 0) {
        showAlert('You need at least one account to make transfers. Please create an account first.', 'error');
    }
}

function updateFromBalance() {
    const accountId = document.getElementById('fromAccount').value;
    const balanceDisplay = document.getElementById('fromBalance');
    
    if (accountId) {
        const account = getAccountById(accountId);
        balanceDisplay.textContent = `Available: ${formatCurrency(account.balance)}`;
        balanceDisplay.style.color = account.balance > 0 ? '#28a745' : '#dc3545';
    } else {
        balanceDisplay.textContent = '';
    }
}

function updateToBalance() {
    const accountId = document.getElementById('toAccount').value;
    const balanceDisplay = document.getElementById('toBalance');
    
    if (accountId) {
        const account = getAccountById(accountId);
        balanceDisplay.textContent = `Current: ${formatCurrency(account.balance)}`;
    } else {
        balanceDisplay.textContent = '';
    }
}

function handleTransfer(e) {
    e.preventDefault();
    
    const fromAccountId = document.getElementById('fromAccount').value;
    const toAccountId = document.getElementById('toAccount').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value.trim() || 'Transfer';
    
    // Validate inputs
    if (!fromAccountId || !toAccountId) {
        showAlert('Please select both source and destination accounts', 'error');
        return;
    }
    
    if (fromAccountId === toAccountId) {
        showAlert('Cannot transfer to the same account', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showAlert('Please enter a valid amount', 'error');
        return;
    }
    
    // Get accounts
    const fromAccount = getAccountById(fromAccountId);
    const toAccount = getAccountById(toAccountId);
    
    // Check if source account has sufficient balance
    if (fromAccount.balance < amount) {
        showAlert('Insufficient funds in source account', 'error');
        return;
    }
    
    // Confirm transfer
    if (!confirm(`Transfer ${formatCurrency(amount)} from ${capitalize(fromAccount.accountType)} to ${capitalize(toAccount.accountType)}?`)) {
        return;
    }
    
    // Perform transfer
    const newFromBalance = fromAccount.balance - amount;
    const newToBalance = toAccount.balance + amount;
    
    updateAccountBalance(fromAccountId, newFromBalance);
    updateAccountBalance(toAccountId, newToBalance);
    
    // Create transaction record
    addTransaction({
        type: 'transfer',
        fromAccountId: fromAccountId,
        toAccountId: toAccountId,
        amount: amount,
        description: description
    });
    
    showAlert('Transfer completed successfully!', 'success');
    
    // Reset form
    document.getElementById('transferForm').reset();
    document.getElementById('fromBalance').textContent = '';
    document.getElementById('toBalance').textContent = '';
    
    // Reload accounts and recent transfers
    loadAccountsInDropdowns();
    loadRecentTransfers();
}

function loadRecentTransfers() {
    const container = document.getElementById('recentTransfers');
    
    transactionsAPI.getAll().then(transactions => {
        // Show all transactions, not just transfers
        renderRecentTransactions(transactions, container);
    }).catch(error => {
        console.error('Error loading transactions:', error);
        container.innerHTML = '<p class="text-center text-slate-500 py-4">Unable to load transactions</p>';
    });
}
