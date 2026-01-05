// features.js - handle quick feature modals and submissions

async function openFeatureModal(id) {
  document.getElementById('modalBackdrop').classList.remove('hidden');
  const modal = document.getElementById('modal-' + id);
  if (!modal) return;
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.remove('translate-y-full'), 10);

  // populate selects for billers and accounts when bill modal opens
  if (id === 'bill') await populateBillModal();
  if (id === 'deposit' || id === 'withdraw') await populateAccountSelectsForCashOp(id);
  if (id === 'deposit') { await populateDepositDetails(); showDepositMethod('bank'); }
  if (id === 'qr') await populateQRFromAccounts();
}

function closeFeatureModal(id) {
  document.getElementById('modalBackdrop').classList.add('hidden');
  const modal = document.getElementById('modal-' + id);
  if (!modal) return;
  modal.classList.add('hidden');
}

async function populateBillModal() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    // fetch billers
    const r1 = await fetch('/api/bills/billers', { headers: { Authorization: 'Bearer ' + token } });
    const billers = await r1.json();
    const billerSelect = document.getElementById('billerSelect');
    billerSelect.innerHTML = '<option value="">Select biller</option>' + billers.map(b=>`<option value="${b.id}" data-biller='${JSON.stringify(b)}'>${b.name} (${b.category})</option>`).join('');

    // when biller changes, try to load billing items for that biller
    billerSelect.onchange = async function() {
      const id = this.value; const billingSelect = document.getElementById('billingSelect');
      billingSelect.innerHTML = '<option value="">Select billing (optional)</option>';
      if (!id) return;
      try {
        const r = await fetch(`/api/bills/billers/${id}/items`, { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return; // no items endpoint
        const items = await r.json();
        if (Array.isArray(items) && items.length) {
          billingSelect.innerHTML = '<option value="">Select billing (optional)</option>' + items.map(it => `<option value="${it.id}" data-amount="${it.amount||''}">${it.description || it.name} ${it.amount? '• ' + Number(it.amount).toFixed(2): ''}</option>`).join('');
          billingSelect.onchange = function(){ const sel = this.selectedOptions[0]; if (sel && sel.dataset && sel.dataset.amount) document.getElementById('billAmount').value = sel.dataset.amount; };
        }
      } catch (e) { console.warn('No billing items for biller', e); }
    };

    // fetch accounts
    const r2 = await fetch('/api/accounts', { headers: { Authorization: 'Bearer ' + token } });
    const accounts = await r2.json();
    const accSel = document.getElementById('fromAccountSelect');
    accSel.innerHTML = '<option value="">From account</option>' + accounts.map(a=>`<option value="${a.id}">${a.account_number} • ${a.account_type} • $${Number(a.balance).toFixed(2)}</option>`).join('');

    // populate payer name from profile
    try {
      const profile = await authAPI.getProfile();
      const payer = document.getElementById('billPayerName');
      if (payer) payer.value = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    } catch (e) { console.warn('Failed to load profile for payer name', e); }
  } catch (e) {
    console.error('Populate bill modal error', e);
  }
}

async function populateAccountSelectsForCashOp(kind) {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const r = await fetch('/api/accounts', { headers: { Authorization: 'Bearer ' + token } });
    const accounts = await r.json();
    const sel = document.getElementById(kind === 'deposit' ? 'depositAccount' : 'withdrawAccount');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select account</option>' + accounts.map(a=>`<option value="${a.id}">${a.account_number} • ${a.account_type} • $${Number(a.balance).toFixed(2)}</option>`).join('');
  } catch (e) {
    console.error('Populate accounts for cash op error', e);
  }
}

function formatCardNumber(number) {
  if (!number) return '';
  const s = String(number).replace(/\s+/g,'').replace(/[^0-9]/g,'');
  return s.match(/.{1,4}/g)?.join(' ') || s;
}

async function populateDepositDetails() {
  try {
    const token = localStorage.getItem('authToken'); if (!token) return;
    // clear previous selections
    document.getElementById('selectedCardId')?.remove();
    document.getElementById('selectedWallet')?.remove();
    // accounts -> populate depositAccount select and bank detail labels
    const accounts = await accountsAPI.getAll();
    const sel = document.getElementById('depositAccount');
    if (sel) {
      sel.innerHTML = '<option value="">Select destination account</option>' + accounts.map(a=>`<option value="${a.id}">${a.account_number} • ${a.account_type}</option>`).join('');
      sel.onchange = () => {
        const id = sel.value; const acc = accounts.find(x=>x.id==id);
        if (acc) {
          document.getElementById('bankAccountNumberLabel').textContent = acc.account_number || '—';
          document.getElementById('bankIbanLabel').textContent = acc.iban || '—';
          document.getElementById('bankAccountTypeLabel').textContent = (acc.account_type||'') ? acc.account_type.charAt(0).toUpperCase()+acc.account_type.slice(1) : '—';
          document.getElementById('bankEmailLabel').textContent = acc.email || (acc.owner && acc.owner.email) || '—';
          document.getElementById('bankPhoneLabel').textContent = acc.phone || (acc.owner && acc.owner.phone) || '—';
        }
      };
    }

    // cards -> populate cardsList (display-only)
    try {
      const cards = await cardsAPI.getAll();
      const cardsList = document.getElementById('cardsList');
      if (cardsList) {
        cardsList.innerHTML = cards.length ? cards.map(c=>`
          <div class="p-2 border rounded cursor-pointer card-select" data-card-id="${c.id}">
            <div class="font-medium">${c.card_type.toUpperCase()} • ${formatCardNumber(c.card_number)}</div>
            <div class="text-xs text-slate-500">Exp: ${new Date(c.expiry_date).toLocaleDateString()}</div>
          </div>
        `).join('') : '<div class="text-xs text-slate-500">No saved cards</div>';
        // wire up selection
        cardsList.querySelectorAll('.card-select').forEach(el=>el.addEventListener('click', ()=>{
          cardsList.querySelectorAll('.card-select').forEach(x=>x.classList.remove('ring','ring-indigo-300'));
          el.classList.add('ring','ring-indigo-300');
          document.getElementById('selectedCardId')?.remove();
          const inp = document.createElement('input'); inp.type='hidden'; inp.id='selectedCardId'; inp.value = el.getAttribute('data-card-id'); document.getElementById('modal-deposit').appendChild(inp);
        }));
      }
    } catch (e) { console.warn('No cards or failed to load cards', e); }

    // crypto wallets: try to read from profile
    try {
      const profile = await authAPI.getProfile();
      const wallets = profile.wallets || profile.cryptoWallets || profile.wallet_addresses || profile.wallets_addresses || [];
      const walletsList = document.getElementById('walletsList');
      if (walletsList) {
        if (Array.isArray(wallets) && wallets.length) {
          walletsList.innerHTML = wallets.map(w=>`<div class="p-2 border rounded cursor-pointer wallet-select" data-wallet-address="${w.address}" data-currency="${w.currency}"><div class="font-medium">${w.currency.toUpperCase()} • ${w.address}</div><div class="text-xs text-slate-500">${w.note||''}</div></div>`).join('');
          walletsList.querySelectorAll('.wallet-select').forEach(el=>el.addEventListener('click', ()=>{
            walletsList.querySelectorAll('.wallet-select').forEach(x=>x.classList.remove('ring','ring-indigo-300'));
            el.classList.add('ring','ring-indigo-300');
            document.getElementById('selectedWallet')?.remove();
            const inp = document.createElement('input'); inp.type='hidden'; inp.id='selectedWallet'; inp.value = JSON.stringify({ address: el.getAttribute('data-wallet-address'), currency: el.getAttribute('data-currency') }); document.getElementById('modal-deposit').appendChild(inp);
          }));
        } else {
          walletsList.innerHTML = '<div class="text-xs text-slate-500">No linked crypto wallets</div>';
        }
      }
    } catch (e) { console.warn('Failed to load profile wallets', e); }

  } catch (e) { console.error('populateDepositDetails error', e); }
}

async function submitDeposit(e) {
  e.preventDefault();
  const token = localStorage.getItem('authToken'); if (!token) return alert('Not signed in');
  const accountId = document.getElementById('depositAccount').value;
  // Determine which method section is visible
  const isCardVisible = !document.getElementById('cardDetails').classList.contains('hidden');
  const isCryptoVisible = !document.getElementById('cryptoDetails').classList.contains('hidden');
  const method = isCardVisible ? 'card' : (isCryptoVisible ? 'crypto' : 'bank');

  try {
    let payload = { accountId, method };
    if (method === 'bank') {
      const amount = parseFloat(document.getElementById('depositAmount').value);
      if (!accountId || !amount || amount <= 0) return alert('Complete form');
      // destination account is accountId; send amount and note that source details were displayed
      payload = { ...payload, amount };
    } else if (method === 'card') {
      const amount = parseFloat(document.getElementById('cardAmount').value);
      const selectedCardId = document.getElementById('selectedCardId') ? document.getElementById('selectedCardId').value : null;
      if (!accountId || !amount || amount <= 0 || !selectedCardId) return alert('Select a card and amount');
      payload = { ...payload, amount, cardId: selectedCardId };
    } else if (method === 'crypto') {
      const amount = parseFloat(document.getElementById('cryptoAmount').value);
      const selectedWalletRaw = document.getElementById('selectedWallet') ? document.getElementById('selectedWallet').value : null;
      if (!accountId || !amount || amount <= 0 || !selectedWalletRaw) return alert('Select a wallet and amount');
      const selectedWallet = JSON.parse(selectedWalletRaw);
      payload = { ...payload, amount, crypto: selectedWallet };
    }

    const res = await fetch('/api/accounts/deposit', {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload)
    });
    const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Deposit failed');
    alert('Deposit submitted — operation result: ' + (json.message || 'success'));
    closeFeatureModal('deposit');
    // refresh dashboard
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (e) { console.error(e); alert('Deposit failed: ' + e.message); }
}

// Toggle deposit method visibility
function showDepositMethod(which) {
  document.querySelectorAll('.deposit-method').forEach(el => el.classList.add('hidden'));
  if (which === 'bank') document.getElementById('deposit-form-bank').classList.remove('hidden');
  if (which === 'card') document.getElementById('cardDetails').classList.remove('hidden');
  if (which === 'crypto') document.getElementById('cryptoDetails').classList.remove('hidden');
}

async function submitWithdraw(e) {
  e.preventDefault();
  const token = localStorage.getItem('authToken'); if (!token) return alert('Not signed in');
  const accountId = document.getElementById('withdrawAccount').value;
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  if (!accountId || !amount || amount <= 0) return alert('Complete form');

  try {
    const res = await fetch('/api/accounts/withdraw', {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ accountId, amount })
    });
    const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Withdraw failed');
    alert('Withdrawal successful — new balance: ' + json.newBalance);
    closeFeatureModal('withdraw');
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (e) { console.error(e); alert('Withdraw failed: ' + e.message); }
}

// Beneficiaries management
async function loadBeneficiaries() {
  try {
    const token = localStorage.getItem('authToken'); if (!token) return;
    let list = [];
    try {
      const r = await fetch('/api/beneficiaries', { headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) list = await r.json();
      else list = getLocalBeneficiaries();
    } catch (err) {
      // fallback to local storage when API not available
      list = getLocalBeneficiaries();
    }
    const container = document.getElementById('beneficiariesList');
    container.innerHTML = list.map(b => `
      <div class="flex items-center justify-between p-2 border rounded">
        <div>
          <div class="font-medium">${b.name} ${b.nickname?`• ${b.nickname}`:''}</div>
          <div class="text-xs text-slate-500">${b.account_number || ''} ${b.bank_name? '• '+b.bank_name : ''}</div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="payBeneficiary('${b.id}')" class="text-sm px-2 py-1 bg-indigo-600 text-white rounded">Pay</button>
          <button onclick="editBeneficiary('${b.id}')" class="text-sm px-2 py-1 border rounded">Edit</button>
          <button onclick="deleteBeneficiary('${b.id}')" class="text-sm px-2 py-1 border rounded">Remove</button>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error('Load beneficiaries error', e); }
}

async function createBeneficiary(e) {
  e.preventDefault();
  const token = localStorage.getItem('authToken'); if (!token) return alert('Sign in');
  const name = document.getElementById('benName').value;
  const accountNumber = document.getElementById('benAccountNumber').value;
  const bank = document.getElementById('benBank').value;
  const nick = document.getElementById('benNickname').value;
  const editingId = document.getElementById('beneficiaryForm').dataset.editing;
  try {
    if (editingId) {
      // update
      try {
        const res = await fetch('/api/beneficiaries/' + editingId, { method: 'PUT', headers: { 'content-type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name, accountNumber, bankName: bank, nickname: nick }) });
        if (!res.ok) throw new Error('Server update failed');
      } catch (err) {
        // fallback to local
        updateLocalBeneficiary(editingId, { name, account_number: accountNumber, bank_name: bank, nickname: nick });
      }
      showToast('Beneficiary updated');
      document.getElementById('beneficiaryForm').dataset.editing = '';
      document.getElementById('beneficiaryForm').querySelector('button[type="submit"]').textContent = 'Add';
      const cancelBtn = document.getElementById('benCancelBtn'); if (cancelBtn) cancelBtn.style.display = 'none';
    } else {
      // create
      try {
        const res = await fetch('/api/beneficiaries', { method: 'POST', headers: { 'content-type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name, accountNumber, bankName: bank, nickname: nick }) });
        if (!res.ok) throw new Error('Server add failed');
      } catch (err) {
        // fallback to local storage
        saveLocalBeneficiary({ name, account_number: accountNumber, bank_name: bank, nickname: nick });
      }
      showToast('Beneficiary added');
    }
    document.getElementById('beneficiaryForm').reset();
    loadBeneficiaries();
  } catch (e) { console.error(e); alert('Failed to add/update beneficiary') }
}

async function deleteBeneficiary(id) {
  if (!confirm('Remove beneficiary?')) return;
  const token = localStorage.getItem('authToken'); if (!token) return;
  try {
    try {
      const res = await fetch('/api/beneficiaries/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('Server delete failed');
    } catch (err) {
      // fallback to local
      removeLocalBeneficiary(id);
    }
    showToast('Beneficiary removed');
    loadBeneficiaries();
  } catch (e) { console.error(e); alert('Delete failed') }
}

// Edit handler to populate form with beneficiary data
async function editBeneficiary(id) {
  const token = localStorage.getItem('authToken');
  let b = null;
  try {
    try {
      const r = await fetch('/api/beneficiaries', { headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) {
        const list = await r.json();
        b = list.find(x => x.id === id);
      }
    } catch (err) {
      // ignore
    }
    if (!b) b = getLocalBeneficiaries().find(x => x.id === id);
  } catch (err) { console.error(err); }
  if (!b) return alert('Beneficiary not found');
  document.getElementById('benName').value = b.name || '';
  document.getElementById('benAccountNumber').value = b.account_number || b.accountNumber || '';
  document.getElementById('benBank').value = b.bank_name || b.bankName || '';
  document.getElementById('benNickname').value = b.nickname || '';
  const form = document.getElementById('beneficiaryForm');
  form.dataset.editing = id;
  form.querySelector('button[type="submit"]').textContent = 'Update';
  const cancel = document.getElementById('benCancelBtn'); if (cancel) cancel.style.display = 'inline-block';
}

// Local storage fallback helpers for beneficiaries
function getLocalBeneficiaries() {
  try { return JSON.parse(localStorage.getItem('localBeneficiaries') || '[]'); } catch (e) { return []; }
}

function saveLocalBeneficiary(obj) {
  const arr = getLocalBeneficiaries();
  const newB = { id: 'local-' + Date.now(), name: obj.name, account_number: obj.account_number || obj.accountNumber || '', bank_name: obj.bank_name || obj.bankName || '', nickname: obj.nickname || '' };
  arr.push(newB);
  localStorage.setItem('localBeneficiaries', JSON.stringify(arr));
}

function updateLocalBeneficiary(id, obj) {
  const arr = getLocalBeneficiaries();
  const idx = arr.findIndex(x => x.id === id);
  if (idx === -1) return false;
  arr[idx] = { ...arr[idx], ...obj };
  localStorage.setItem('localBeneficiaries', JSON.stringify(arr));
  return true;
}

function removeLocalBeneficiary(id) {
  const arr = getLocalBeneficiaries().filter(x => x.id !== id);
  localStorage.setItem('localBeneficiaries', JSON.stringify(arr));
}

async function payBeneficiary(id) {
  // Find beneficiary and open QR pay modal prefilled
  const token = localStorage.getItem('authToken'); if (!token) return;
  try {
    const r = await fetch('/api/beneficiaries', { headers: { Authorization: 'Bearer ' + token } });
    const list = await r.json();
    const b = list.find(x=>x.id===id);
    if (!b) return alert('Beneficiary not found');
    openFeatureModal('qr');
    // wait a tick for modal fields
    setTimeout(()=>{
      document.getElementById('qrAccountNumber').value = b.account_number || '';
    }, 200);
  } catch (e) { console.error(e); }
}

async function populateQRFromAccounts() {
  try {
    const token = localStorage.getItem('authToken'); if (!token) return;
    const r = await fetch('/api/accounts', { headers: { Authorization: 'Bearer ' + token } });
    const accounts = await r.json();
    const sel = document.getElementById('qrFromAccount');
    sel.innerHTML = '<option value="">From account</option>' + accounts.map(a=>`<option value="${a.id}">${a.account_number} • ${a.account_type} • $${Number(a.balance).toFixed(2)}</option>`).join('');
  } catch (e) { console.error('Populate QR accounts error', e); }
}

async function submitQRPay(e) {
  e.preventDefault();
  const token = localStorage.getItem('authToken'); if (!token) return alert('Sign in');
  const fromId = document.getElementById('qrFromAccount').value;
  const accNum = document.getElementById('qrAccountNumber').value;
  const amount = parseFloat(document.getElementById('qrAmount').value);
  if (!fromId || !accNum || !amount) return alert('Complete form');
  try {
    // lookup account
    const lookup = await fetch('/api/accounts/lookup', { method: 'POST', headers: { 'content-type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ accountNumber: accNum }) });
    const dest = await lookup.json(); if (!lookup.ok) throw new Error(dest.error || 'No account');

    const transfer = await fetch('/api/transactions/transfer', { method: 'POST', headers: { 'content-type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ fromAccountId: fromId, toAccountId: dest.id, amount, description: 'QR Pay' }) });
    const tj = await transfer.json(); if (!transfer.ok) throw new Error(tj.error || 'Transfer failed');
    showToast('Payment sent');
    closeFeatureModal('qr');
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (e) { console.error(e); alert('Payment failed: ' + (e.message||e)); }
}

async function submitBill(e) {
  e.preventDefault();
  const token = localStorage.getItem('authToken');
  if (!token) return alert('Not signed in');
  const billerId = document.getElementById('billerSelect').value;
  const billingItemId = document.getElementById('billingSelect') ? document.getElementById('billingSelect').value : null;
  const fromAccountId = document.getElementById('fromAccountSelect').value;
  const amount = document.getElementById('billAmount').value;
  const memo = document.getElementById('billMemo').value;
  const payer = document.getElementById('billPayerName') ? document.getElementById('billPayerName').value : '';

  if (!billerId || !fromAccountId || !amount) return alert('Please complete the form');

  try {
    const res = await fetch('/api/bills/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ billerId, billingItemId, fromAccountId, amount: parseFloat(amount), paymentDate: new Date().toISOString(), memo, payer })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Payment failed');
    alert('Bill paid — new balance: ' + json.newBalance);
    closeFeatureModal('bill');
  } catch (err) {
    console.error(err);
    alert('Payment failed: ' + (err.message || err));
  }
}

async function submitAirtime(e) {
  e.preventDefault();
  const phone = document.getElementById('phoneNumber').value;
  const amount = document.getElementById('airtimeAmount').value;
  const provider = document.getElementById('airtimeProvider') ? document.getElementById('airtimeProvider').value : null;
  if (!phone || !amount || !provider) return alert('Complete details');
  const token = localStorage.getItem('authToken');
  try {
    if (token) {
      const res = await fetch('/api/airtime/purchase', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ phone, amount: parseFloat(amount), provider })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Purchase failed');
      alert('Airtime bought: $' + amount + ' for ' + phone + ' via ' + provider + (json.newBalance ? ' — new balance: ' + json.newBalance : ''));
    } else {
      alert(`Airtime bought: $${amount} for ${phone} via ${provider} (demo)`);
    }
    closeFeatureModal('airtime');
  } catch (err) {
    console.error(err);
    alert('Airtime purchase failed: ' + (err.message || err));
  }
}

async function submitBet(e) {
  e.preventDefault();
  const amt = document.getElementById('betAmount').value;
  const type = document.getElementById('betType').value;
  if (!amt) return alert('Enter bet amount');
  // Simulate betting — DO NOT wire to real gambling APIs in production without checks
  alert(`Bet placed: $${amt} (${type}) — demo only`);
  closeFeatureModal('bet');
}

async function submitLoan(e) {
  e.preventDefault();
  const token = localStorage.getItem('authToken'); if (!token) return alert('Not signed in');
  const amount = parseFloat(document.getElementById('loanAmount').value);
  const term = parseInt(document.getElementById('loanTerm').value, 10);
  const purpose = document.getElementById('loanPurpose').value || '';
  if (!amount || amount <= 0 || !term) return alert('Please complete the form');

  try {
    const res = await fetch('/api/loans/apply', {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount, term, purpose })
    });
    const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Loan application failed');
    alert('Loan application submitted — reference: ' + (json.reference || json.id || 'n/a'));
    closeFeatureModal('loan');
  } catch (err) { console.error(err); alert('Loan application failed: ' + (err.message || err)); }
}

// Expose to global
window.openFeatureModal = openFeatureModal;
window.closeFeatureModal = closeFeatureModal;
window.submitBill = submitBill;
window.submitAirtime = submitAirtime;
window.submitBet = submitBet;
window.submitDeposit = submitDeposit;
window.submitWithdraw = submitWithdraw;
window.submitLoan = submitLoan;
