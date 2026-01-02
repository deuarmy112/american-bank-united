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
}

function closeFeatureModal(id) {
  document.getElementById('modalBackdrop').classList.add('hidden');
  const modal = document.getElementById('modal-' + id);
  if (!modal) return;
  modal.classList.add('hidden');
}

async function populateBillModal() {
  try {
    const token = localStorage.getItem('token');
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
    const token = localStorage.getItem('token');
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
  const token = localStorage.getItem('token'); if (!token) return alert('Not signed in');
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
  const token = localStorage.getItem('token'); if (!token) return alert('Not signed in');
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

async function submitBill(e) {
  e.preventDefault();
  const token = localStorage.getItem('token');
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

// Expose to global
window.openFeatureModal = openFeatureModal;
window.closeFeatureModal = closeFeatureModal;
window.submitBill = submitBill;
window.submitAirtime = submitAirtime;
window.submitBet = submitBet;
window.submitDeposit = submitDeposit;
window.submitWithdraw = submitWithdraw;
