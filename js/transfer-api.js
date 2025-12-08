/* 
 * Transfer Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    await displayUserName();
    await loadAccounts();
});

async function loadAccounts() {
    try {
        const accounts = await accountsAPI.getAll();
        
        const fromSelect = document.getElementById('fromAccount');
        const toSelect = document.getElementById('toAccount');
        
        // Clear existing options except first
        fromSelect.innerHTML = '<option value="">Select Account</option>';
        toSelect.innerHTML = '<option value="">Select Account</option>';
        
        accounts.forEach(account => {
            const optionText = `${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} - ${account.account_number} (${formatCurrency(account.balance)})`;
            
            const fromOption = new Option(optionText, account.id);
            const toOption = new Option(optionText, account.id);
            
            fromSelect.add(fromOption);
            toSelect.add(toOption);
        });
        
        // Add change listener to show balance
        fromSelect.addEventListener('change', async function() {
            const selectedAccount = accounts.find(acc => acc.id === this.value);
            const balanceDisplay = document.getElementById('fromAccountBalance');
            if (selectedAccount) {
                balanceDisplay.textContent = `Available Balance: ${formatCurrency(selectedAccount.balance)}`;
            } else {
                balanceDisplay.textContent = '';
            }
        });
        
    } catch (error) {
        console.error('Failed to load accounts:', error);
        showAlert('Failed to load accounts', 'error');
    }
}

// Handle transfer form submission
document.getElementById('transferForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fromAccountId = document.getElementById('fromAccount').value;
    const toAccountId = document.getElementById('toAccount').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value.trim();
    
    // Validation
    if (!fromAccountId || !toAccountId) {
        showAlert('Please select both accounts', 'error');
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
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;
        
        await transactionsAPI.transfer(fromAccountId, toAccountId, amount, description);
        
        showAlert('Transfer completed successfully!', 'success');
        
        // Reset form
        e.target.reset();
        document.getElementById('fromAccountBalance').textContent = '';
        
        // Reload accounts to update balances
        await loadAccounts();
        
        submitBtn.textContent = 'Transfer';
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Transfer failed:', error);
        showAlert(error.message || 'Transfer failed', 'error');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Transfer';
        submitBtn.disabled = false;
    }
});
