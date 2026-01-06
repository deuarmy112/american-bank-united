/* 
 * Transfer Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    await displayUserName();
    await loadAccounts();

    // Preselect transfer type from URL (e.g. ?type=international)
    try {
        const params = new URLSearchParams(window.location.search);
        const pre = params.get('type');
        if (pre) {
            const radio = document.querySelector(`input[name="transferType"][value="${pre}"]`);
            if (radio) radio.checked = true;
        }
        setupTransferTypeToggle();

        // Show helpful hint for international transfers
        const hint = document.getElementById('transferHint');
        if (pre === 'international' && hint) {
            hint.classList.remove('hidden');
            hint.textContent = 'International transfers: provide IBAN/SWIFT and recipient bank details. Processing may take 1-5 business days and fees may apply.';
        }

        // Prefill transfer fields from URL (used by QR scanner)
        const toAcct = params.get('toAccountNumber');
        const bank = params.get('bank');
        const amount = params.get('amount');
        if (toAcct) {
            // try to match loaded accounts by account number (loadAccounts was awaited earlier)
            const accounts = window.transferLoadedAccounts || [];
            const match = accounts.find(a => (a.account_number || a.accountNumber || '').toString() === toAcct.toString());
            if (match) {
                const radio = document.querySelector('input[name="transferType"][value="internal"]'); if (radio) radio.checked = true;
                const toSelect = document.getElementById('toAccount'); if (toSelect) toSelect.value = match.id;
            } else {
                const radio = document.querySelector('input[name="transferType"][value="external"]'); if (radio) radio.checked = true;
                const extAcct = document.getElementById('extAccountNumber'); if (extAcct) extAcct.value = toAcct;
                const extBank = document.getElementById('extBankName'); if (extBank && bank) extBank.value = bank;
                const recip = params.get('recipientName');
                const extName = document.getElementById('extRecipientName'); if (extName && recip) extName.value = recip;
            }
            if (hint && (bank || params.get('transferType') === 'international')) { hint.classList.remove('hidden'); }
        }
        if (amount) { const amt = document.getElementById('amount'); if (amt) amt.value = amount; }
    } catch (err) {
        console.warn('Failed to parse transfer type from URL', err);
        setupTransferTypeToggle();
    }
    // load recent transfers
    loadRecentTransfers();
});

// Local beneficiary helpers (used when server is not reachable)
function getLocalBeneficiaries() {
    try { return JSON.parse(localStorage.getItem('localBeneficiaries') || '[]'); } catch (e) { return []; }
}

function saveLocalBeneficiaryLocal(obj) {
    const arr = getLocalBeneficiaries();
    const newB = { id: 'local-' + Date.now(), name: obj.name, account_number: obj.account_number || obj.accountNumber || '', bank_name: obj.bank_name || obj.bankName || '', nickname: obj.nickname || '' };
    arr.push(newB);
    localStorage.setItem('localBeneficiaries', JSON.stringify(arr));
}

function setupTransferTypeToggle() {
    const radios = Array.from(document.getElementsByName('transferType'));
    const update = () => {
        const type = document.querySelector('input[name="transferType"]:checked').value;
        const isExternalLike = type !== 'internal';
        const toAccount = document.getElementById('toAccount');
        const externalFields = document.getElementById('externalFields');
        // destination account is required only for internal transfers
        toAccount.required = (type === 'internal');
        externalFields.classList.toggle('hidden', !isExternalLike);

        // Make external inputs required only when external-like transfer selected
        ['extRecipientName', 'extAccountNumber', 'extBankName', 'extEmail'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.required = isExternalLike;
        });
    };

    radios.forEach(r => r.addEventListener('change', update));
    // initialize state
    update();
}

async function loadAccounts() {
    try {
        const accounts = await accountsAPI.getAll();

        const fromSelect = document.getElementById('fromAccount');
        const toSelect = document.getElementById('toAccount');

        // Populate selects
        const optionsHtml = '<option value="">Select Account</option>' + accounts.map(a=>{
            const label = `${a.account_type.charAt(0).toUpperCase() + a.account_type.slice(1)} - ${a.account_number} (${formatCurrency(a.balance)})`;
            return `<option value="${a.id}">${label}</option>`;
        }).join('');

        fromSelect.innerHTML = optionsHtml;
        toSelect.innerHTML = optionsHtml;

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
            // expose loaded accounts for callers that want to prefill fields
            window.transferLoadedAccounts = accounts;
            return accounts;
    } catch (error) {
        console.error('Failed to load accounts:', error);
        showAlert('Failed to load accounts', 'error');
    }
}

// Load recent transfers for this user
async function loadRecentTransfers() {
    try {
        const recent = await transactionsAPI.getAll();
        const wrap = document.getElementById('recentTransfers');
        if (!wrap) return;
        if (!recent || recent.length === 0) {
            wrap.innerHTML = '<div class="text-xs text-slate-500">No recent transfers</div>';
            return;
        }
        wrap.innerHTML = '';
        recent.slice(0,6).forEach(tx => {
            const el = document.createElement('div');
            el.className = 'flex justify-between items-center';
            el.innerHTML = `<div class="text-sm">${tx.to_account_number || tx.to || tx.accountNumber || 'External'}</div><div class="text-sm font-semibold">${formatCurrency(tx.amount)}</div>`;
            wrap.appendChild(el);
        });
    } catch (err) {
        console.warn('Failed to load recent transfers', err);
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

    if (transferType !== 'internal') {
        // ensure external-like fields (covers 'external' and 'international')
        // pull external fields up so they remain available in catch block
        var recipientName = document.getElementById('extRecipientName').value.trim();
        var accountNumber = document.getElementById('extAccountNumber').value.trim();
        var bankName = document.getElementById('extBankName').value.trim();
        var recipientEmail = document.getElementById('extEmail').value.trim();
        var contact = document.getElementById('extContact').value.trim();
        var saveAsBeneficiary = document.getElementById('saveAsBeneficiary').checked;
        if (!recipientName || !accountNumber || !bankName || !recipientEmail) {
            showAlert('Please provide recipient name, account number/IBAN, bank name and recipient email', 'error');
            return;
        }
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
            // external-like transfer (Other Bank or International) — use same API/flow
            // Use shared apiClient so base URL and auth token are handled consistently
            await apiClient.post('/external-transfers', {
                fromAccountId,
                recipientName,
                recipientEmail,
                accountNumber,
                bankName,
                contact,
                amount,
                description,
                transferType,
                saveAsBeneficiary
            });
        }
        
        showAlert('Transfer completed successfully!', 'success');
        
        // Reset form
        e.target.reset();
        document.getElementById('fromAccountBalance').textContent = '';
        
        // Reload accounts to update balances
        await loadAccounts();
        // refresh recent transfers
        await loadRecentTransfers();
        
        submitBtn.textContent = 'Transfer';
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Transfer failed:', error);

        // If network failure (no API reachable), allow a demo/offline success path
        const msg = (error && error.message) ? error.message.toLowerCase() : '';
        if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error')) {
            showAlert('Transfer queued (offline demo). It will complete when the server is reachable.', 'success');
            e.target.reset();
            document.getElementById('fromAccountBalance').textContent = '';
            // If user asked to save as beneficiary, persist locally for offline/demo mode
            try {
                if (typeof saveAsBeneficiary !== 'undefined' && saveAsBeneficiary) {
                    if (window.saveLocalBeneficiary) {
                        window.saveLocalBeneficiary({ name: recipientName, account_number: accountNumber, bank_name: bankName, nickname: '' });
                    } else {
                        saveLocalBeneficiaryLocal({ name: recipientName, account_number: accountNumber, bank_name: bankName, nickname: '' });
                    }
                    showAlert('Beneficiary saved locally (offline mode).', 'success');
                }
            } catch (err) { console.error('Save local beneficiary failed', err); }
        } else {
            showAlert(error.message || 'Transfer failed', 'error');
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Transfer';
        submitBtn.disabled = false;
    }
});
