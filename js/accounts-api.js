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
        // notify other components (balance carousel) that accounts were updated
        window.dispatchEvent(new CustomEvent('accounts:updated', { detail: accounts }));
    } catch (error) {
        console.error('Failed to load accounts:', error);
        showAlert('Failed to load accounts', 'error');
    }
}

function displayAccounts(accounts) {
    const accountsList = document.getElementById('accountsList');
    if (!accountsList) {
        console.error('accountsList element not found');
        return;
    }
    
    if (!accounts || accounts.length === 0) {
        accountsList.innerHTML = '<p class="no-data">No accounts yet. Create your first account below.</p>';
        return;
    }

    accountsList.innerHTML = '';

    const selectedId = localStorage.getItem('selectedAccountId');

    // compute total balance
    const total = accounts.reduce((s,a)=> s + (parseFloat(a.balance) || 0), 0);
    const totalEl = document.getElementById('accountsTotalBalance');
    if (totalEl) totalEl.textContent = formatCurrency(total);

    accounts.forEach(account => {
        const card = document.createElement('div');
        card.className = 'account-card opay-card';
        if (selectedId && selectedId === account.id) card.classList.add('selected-account');
        card.innerHTML = `
            <div class="account-header">
                <div>
                  <div class="text-sm text-slate-500">${capitalize(account.account_type)} • ****${account.account_number.slice(-4)}</div>
                  <div class="text-xs text-slate-400">${account.account_nickname || ''}</div>
                </div>
                <div class="account-type-badge">${capitalize(account.account_type)}</div>
            </div>
            <div class="mt-3">
                <div class="account-balance text-lg font-semibold">${formatCurrency(account.balance)}</div>
                <div class="account-date text-xs text-slate-400 mt-1">Opened: ${formatDate(account.created_at)}</div>
            </div>
            <div class="account-actions">
                <button class="opay-btn" onclick='selectAccount(${JSON.stringify(account)})'>Select</button>
                <button class="opay-btn" onclick="location.href='transactions.html?account=${account.id}'">Transactions</button>
                <button class="opay-btn" onclick="location.href='transfer.html'">Transfer</button>
            </div>
        `;
        accountsList.appendChild(card);
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
    const m = document.getElementById('createAccountModal');
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closeCreateAccountModal() {
    const m = document.getElementById('createAccountModal');
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('flex');
}

// Handle create account form submission
document.getElementById('createAccountForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const accountType = document.getElementById('accountType').value;
    const initialDeposit = parseFloat(document.getElementById('initialDeposit').value || '0');
    const nickname = (document.getElementById('accountNickname')?.value || '').trim();

    if (!accountType) {
        showAlert('Please select an account type', 'error');
        return;
    }

    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;

        const payload = { accountType, initialDeposit };
        if (nickname) payload.nickname = nickname;

        const response = await accountsAPI.create(payload);

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
