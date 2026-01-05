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
    
    const selectedId = localStorage.getItem('selectedAccountId');

    accounts.forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card-full';
        // highlight if selected
        if (selectedId && selectedId === account.id) accountCard.classList.add('selected-account');
        accountCard.innerHTML = `
            <div class="account-header">
                <h3>${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} Account</h3>
                <span class="account-status ${account.status}">${account.status}</span>
            </div>
            <p class="account-number">Account Number: ${account.account_number}</p>
            <p class="account-balance">${formatCurrency(account.balance)}</p>
            <p class="account-date">Opened: ${formatDate(account.created_at)}</p>
            <div class="mt-3">
                <button class="btn btn-sm btn-primary" onclick='selectAccount(${JSON.stringify(account)})'>Use this account</button>
            </div>
        `;
        accountsList.appendChild(accountCard);
    });
}

// Select an account to be used as current account on dashboard
function selectAccount(account) {
    try {
        if (!account || !account.id) return;
        localStorage.setItem('selectedAccountId', account.id);
        showToast('Selected account: ****' + account.account_number.slice(-4));

        // update any open dashboard elements on the same page
        const labelEl = document.getElementById('currentAccountLabel');
        const availEl = document.getElementById('currentAccountAvailable');
        if (labelEl) labelEl.textContent = `${capitalize(account.account_type)} • ****${account.account_number.slice(-4)}`;
        if (availEl) availEl.textContent = formatCurrency(account.balance);

        // Visually mark selected card
        document.querySelectorAll('.account-card-full').forEach(el => el.classList.remove('selected-account'));
        // Try to find card by account number text
        const cards = Array.from(document.querySelectorAll('.account-card-full'));
        for (const c of cards) {
            if (c.innerText.includes(account.account_number)) { c.classList.add('selected-account'); break; }
        }
    } catch (e) { console.error('Select account error', e); }
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
