/* 
 * Transfer Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    await displayUserName();
    await loadAccounts();
    setupTransferTypeToggle();
});

function setupTransferTypeToggle() {
    const radios = document.getElementsByName('transferType');
    radios.forEach(r => r.addEventListener('change', () => {
        const isExternal = document.querySelector('input[name="transferType"]:checked').value === 'external';
        document.getElementById('toAccount').required = !isExternal;
        document.getElementById('externalFields').classList.toggle('hidden', !isExternal);
    }));
}

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

        // also populate toAccount select with internal accounts
        const toSelect = document.getElementById('toAccount');
        toSelect.innerHTML = '<option value="">Select Account</option>' + accounts.map(a=>`<option value="${a.id}">${a.account_type} - ${a.account_number} (${formatCurrency(a.balance)})</option>`).join('');
        
    } catch (error) {
        console.error('Failed to load accounts:', error);
        showAlert('Failed to load accounts', 'error');
    }
}

// Handle transfer form submission
document.getElementById('transferForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fromAccountId = document.getElementById('fromAccount').value;
    const transferType = document.querySelector('input[name="transferType"]:checked').value;
    const toAccountId = document.getElementById('toAccount').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value.trim();
    
    // Validation
    if (!fromAccountId) { showAlert('Select source account', 'error'); return; }

    if (transferType === 'internal') {
        if (!toAccountId) { showAlert('Please select destination account', 'error'); return; }
        if (fromAccountId === toAccountId) { showAlert('Cannot transfer to the same account', 'error'); return; }
    }

    if (transferType === 'external') {
        // ensure external fields
        const name = document.getElementById('extRecipientName').value.trim();
        const acct = document.getElementById('extAccountNumber').value.trim();
        const bank = document.getElementById('extBankName').value.trim();
        if (!name || !acct || !bank) { showAlert('Please provide recipient name, account number/IBAN and bank name', 'error'); return; }
    }
    
    if (!amount || amount <= 0) {
        showAlert('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;
        
        if (transferType === 'internal') {
            await transactionsAPI.transfer(fromAccountId, toAccountId, amount, description);
        } else {
            // external transfer
            const recipientName = document.getElementById('extRecipientName').value.trim();
            const accountNumber = document.getElementById('extAccountNumber').value.trim();
            const bankName = document.getElementById('extBankName').value.trim();
            const contact = document.getElementById('extContact').value.trim();
            const saveAsBeneficiary = document.getElementById('saveAsBeneficiary').checked;

            const token = localStorage.getItem('token');
            const res = await fetch('/api/external-transfers', {
                method: 'POST', headers: { 'content-type':'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ fromAccountId, recipientName, accountNumber, bankName, contact, amount, description, saveAsBeneficiary })
            });
            const jr = await res.json();
            if (!res.ok) throw new Error(jr.error || 'External transfer failed');
        }
        
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
