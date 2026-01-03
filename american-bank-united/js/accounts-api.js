/* 
 * Accounts Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    await displayUserName();
    await loadAccounts();
});

async function loadAccounts() {
    try {
        const accounts = await accountsAPI.getAll();
        displayAccounts(accounts);
    } catch (error) {
        console.error('Failed to load accounts:', error);
        showAlert('Failed to load accounts', 'error');
    }
}

function displayAccounts(accounts) {
    const accountsList = document.getElementById('accountsList');
    
    if (accounts.length === 0) {
        accountsList.innerHTML = '<p class="no-data">No accounts yet. Create your first account below.</p>';
        return;
    }
    
    accountsList.innerHTML = '';
    
    accounts.forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card-full';
        accountCard.innerHTML = `
            <div class="account-header">
                <h3>${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} Account</h3>
                <span class="account-status ${account.status}">${account.status}</span>
            </div>
            <p class="account-number">Account Number: ${account.account_number}</p>
            <p class="account-balance">${formatCurrency(account.balance)}</p>
            <p class="account-date">Opened: ${formatDate(account.created_at)}</p>
        `;
        accountsList.appendChild(accountCard);
    });
}

// Modal functions
function showCreateAccountModal() {
    document.getElementById('createAccountModal').style.display = 'flex';
}

function closeCreateAccountModal() {
    document.getElementById('createAccountModal').style.display = 'none';
}

// Handle create account form submission
document.getElementById('createAccountForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const accountType = document.getElementById('accountType').value;
    
    if (!accountType) {
        showAlert('Please select an account type', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;
        
        const response = await accountsAPI.create(accountType);
        
        showAlert('Account created successfully!', 'success');
        closeCreateAccountModal();
        
        // Reload accounts
        await loadAccounts();
        
        // Reset form
        e.target.reset();
        submitBtn.textContent = 'Create Account';
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Failed to create account:', error);
        showAlert(error.message || 'Failed to create account', 'error');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Create Account';
        submitBtn.disabled = false;
    }
});
