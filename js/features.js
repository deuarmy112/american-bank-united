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
    billerSelect.innerHTML = '<option value="">Select biller</option>' + billers.map(b=>`<option value="${b.id}">${b.name} (${b.category})</option>`).join('');

    // fetch accounts
    const r2 = await fetch('/api/accounts', { headers: { Authorization: 'Bearer ' + token } });
    const accounts = await r2.json();
    const accSel = document.getElementById('fromAccountSelect');
    accSel.innerHTML = '<option value="">From account</option>' + accounts.map(a=>`<option value="${a.id}">${a.account_number} • ${a.account_type} • $${Number(a.balance).toFixed(2)}</option>`).join('');
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

async function submitDeposit(e) {
  e.preventDefault();
  const token = localStorage.getItem('authToken'); if (!token) return alert('Not signed in');
  const accountId = document.getElementById('depositAccount').value;
  const amount = parseFloat(document.getElementById('depositAmount').value);
  if (!accountId || !amount || amount <= 0) return alert('Complete form');

  try {
    const res = await fetch('/api/accounts/deposit', {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ accountId, amount })
    });
    const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Deposit failed');
    alert('Deposit successful — new balance: ' + json.newBalance);
    closeFeatureModal('deposit');
    // refresh dashboard
    if (window.loadDashboardData) window.loadDashboardData();
  } catch (e) { console.error(e); alert('Deposit failed: ' + e.message); }
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
    const r = await fetch('/api/beneficiaries', { headers: { Authorization: 'Bearer ' + token } });
    const list = await r.json();
    const container = document.getElementById('beneficiariesList');
    container.innerHTML = list.map(b => `
      <div class="flex items-center justify-between p-2 border rounded">
        <div>
          <div class="font-medium">${b.name} ${b.nickname?`• ${b.nickname}`:''}</div>
          <div class="text-xs text-slate-500">${b.account_number || ''} ${b.bank_name? '• '+b.bank_name : ''}</div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="payBeneficiary('${b.id}')" class="text-sm px-2 py-1 bg-indigo-600 text-white rounded">Pay</button>
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
  try {
    const res = await fetch('/api/beneficiaries', { method: 'POST', headers: { 'content-type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name, accountNumber, bankName: bank, nickname: nick }) });
    const j = await res.json(); if (!res.ok) throw new Error(j.error || 'Failed');
    showToast('Beneficiary added');
    document.getElementById('beneficiaryForm').reset();
    loadBeneficiaries();
  } catch (e) { console.error(e); alert('Failed to add beneficiary') }
}

async function deleteBeneficiary(id) {
  if (!confirm('Remove beneficiary?')) return;
  const token = localStorage.getItem('authToken'); if (!token) return;
  try {
    const res = await fetch('/api/beneficiaries/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('Failed');
    showToast('Beneficiary removed');
    loadBeneficiaries();
  } catch (e) { console.error(e); alert('Delete failed') }
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
  const fromAccountId = document.getElementById('fromAccountSelect').value;
  const amount = document.getElementById('billAmount').value;
  const memo = document.getElementById('billMemo').value;

  if (!billerId || !fromAccountId || !amount) return alert('Please complete the form');

  try {
    const res = await fetch('/api/bills/payments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ billerId, fromAccountId, amount: parseFloat(amount), paymentDate: new Date().toISOString(), memo })
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
  if (!phone || !amount) return alert('Complete details');
  // Simulate purchase — in real app call operator API and create transaction
  alert(`Airtime bought: $${amount} for ${phone} (demo)`);
  closeFeatureModal('airtime');
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
