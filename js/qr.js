// QR page logic: scanner and display user QR

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('authToken')) {
    localStorage.setItem('authToken', 'guest-token');
  }

  const $ = id => document.getElementById(id);
  const scanTab = $('scanTab');
  const showTab = $('showTab');
  const scanPane = $('scanPane');
  const showPane = $('showPane');
  const startBtn = $('startScan');
  const stopBtn = $('stopScan');
  const resultEl = $('scanResult');
  const readerId = 'reader';

  if (!scanPane && !showPane) return; // nothing to do

  let html5QrcodeScanner = null;
  let pendingRedirect = null;
  let scannerLibraryPromise = null;
  let scannerStarting = false;

  function loadScannerLibrary() {
    if (typeof window.Html5Qrcode === 'function') return Promise.resolve();
    if (scannerLibraryPromise) return scannerLibraryPromise;
    scannerLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/minified/html5-qrcode.min.js';
      script.async = true;
      script.onload = () => typeof window.Html5Qrcode === 'function'
        ? resolve()
        : reject(new Error('Scanner library loaded without camera support'));
      script.onerror = () => reject(new Error('Scanner library could not be loaded. Check your connection and try again.'));
      document.head.appendChild(script);
    });
    return scannerLibraryPromise;
  }

  function selectTab(activeTab, inactiveTab, activePane, inactivePane) {
    activePane.classList.remove('hidden');
    inactivePane.classList.add('hidden');
    activeTab.classList.add('active');
    inactiveTab.classList.remove('active');
    activeTab.setAttribute('aria-selected', 'true');
    inactiveTab.setAttribute('aria-selected', 'false');
  }
  if (scanTab && showPane) scanTab.addEventListener('click', () => {
    selectTab(scanTab, showTab, scanPane, showPane);
    if (!html5QrcodeScanner && !scannerStarting) startScanner();
  });
  if (showTab && showPane) showTab.addEventListener('click', () => selectTab(showTab, scanTab, showPane, scanPane));

  async function startScanner(){
    if (!startBtn || !stopBtn || scannerStarting || html5QrcodeScanner) return;
    scannerStarting = true;
    startBtn.style.display = 'none'; stopBtn.style.display = 'inline-block';
    try {
      await loadScannerLibrary();
      html5QrcodeScanner = new window.Html5Qrcode(readerId);
      await html5QrcodeScanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, onScanSuccess, onScanFailure);
    } catch (err) {
      console.error('Scanner start failed', err);
      const cameraHint = /permission|secure|notallowed|denied/i.test(err.message || '')
        ? ' Allow camera access and open this page over HTTPS.'
        : '';
      if (resultEl) resultEl.textContent = 'Unable to start camera: ' + (err.message || err) + cameraHint;
      html5QrcodeScanner = null;
      startBtn.style.display = 'inline-block'; stopBtn.style.display = 'none';
    } finally {
      scannerStarting = false;
    }
  }

  async function stopScanner(){
    if (!stopBtn || !startBtn) return;
    stopBtn.style.display = 'none'; startBtn.style.display = 'inline-block';
    try { if (html5QrcodeScanner && html5QrcodeScanner.stop) await html5QrcodeScanner.stop(); } catch(e) { console.error(e); }
  }

  if (startBtn) startBtn.addEventListener('click', startScanner);
  if (stopBtn) stopBtn.addEventListener('click', stopScanner);

  // scan success must be async if we await inside
  async function onScanSuccess(decodedText, decodedResult) {
    if (resultEl) resultEl.textContent = decodedText;
    let payload = null;
    try { payload = JSON.parse(decodedText); } catch (e) { payload = null; }

    if (payload && (payload.accountNumber || payload.iban || payload.account_number)) {
      const acct = payload.accountNumber || payload.iban || payload.account_number;
      const bank = payload.bankName || payload.bank || payload.bank_name || '';
      const amount = payload.amount || '';
      const recipName = payload.name || payload.recipientName || payload.payee || payload.payee_name || '';
      try { if (html5QrcodeScanner && html5QrcodeScanner.stop) await html5QrcodeScanner.stop(); } catch(e){console.warn(e);} 
      pendingRedirect = { acct, bank, amount, recipName };
      showConfirmation(pendingRedirect);
      return;
    }

    if (!payload && decodedText) {
      try { if (html5QrcodeScanner && html5QrcodeScanner.stop) await html5QrcodeScanner.stop(); } catch(e){console.warn(e);} 
      pendingRedirect = { acct: decodedText, bank: '', amount: '', recipName: '' };
      showConfirmation(pendingRedirect);
    }
  }

  function onScanFailure(error) {
    // optional logging
  }

  // Generate user's QR for receiving deposits
  try {
    let accountNumber = '';
    if (typeof accountsAPI !== 'undefined' && typeof accountsAPI.getAll === 'function') {
      try {
        const accs = await accountsAPI.getAll();
        if (accs && accs.length) accountNumber = accs[0].account_number || accs[0].accountNumber || accs[0].number || '';
      } catch (e) { /* ignore */ }
    } else if (typeof window.accountsAPI !== 'undefined' && typeof window.accountsAPI.getAll === 'function') {
      try { const accs = await window.accountsAPI.getAll(); if (accs && accs.length) accountNumber = accs[0].account_number || accs[0].accountNumber || accs[0].number || ''; } catch(e){}
    } else if (typeof getCurrentUser === 'function' && typeof getUserAccounts === 'function') {
      try { const user = getCurrentUser(); const accs = getUserAccounts(user.id); if (accs && accs.length) accountNumber = accs[0].accountNumber || accs[0].account_number || accs[0].number || ''; } catch(e){}
    } else {
      // fallback to localStorage selected account id or number
      accountNumber = localStorage.getItem('selectedAccountNumber') || localStorage.getItem('selectedAccountId') || '';
    }

    const payload = { bank: 'American Bank United', accountNumber: accountNumber || '', note: 'ABU deposit' };
    const container = $('myQrContainer');
    if (container && typeof QRCode === 'function') {
      container.innerHTML = '';
      new QRCode(container, { text: JSON.stringify(payload), width: 200, height: 200 });
    }
  } catch (e) { console.error('QR gen failed', e); }

  // Confirmation UI handlers
  const confirmPane = $('confirmPane');
  const confirmDetails = $('confirmDetails');
  const confirmBtn = $('confirmBtn');
  const cancelConfirmBtn = $('cancelConfirmBtn');

  function showConfirmation(p) {
    if (scanPane) scanPane.classList.add('hidden');
    if (confirmPane) confirmPane.classList.remove('hidden');
    const lines = [];
    if (p.recipName) lines.push(`<strong>Recipient:</strong> ${p.recipName}`);
    lines.push(`<strong>Account:</strong> ${p.acct}`);
    if (p.bank) lines.push(`<strong>Bank:</strong> ${p.bank}`);
    if (p.amount) lines.push(`<strong>Amount:</strong> $${p.amount}`);
    if (confirmDetails) confirmDetails.innerHTML = lines.join('<br>');
  }

  async function resumeScanner() {
    if (confirmPane) confirmPane.classList.add('hidden');
    if (scanPane) scanPane.classList.remove('hidden');
    if (resultEl) resultEl.textContent = 'No scan yet';
    pendingRedirect = null;
    try {
      if (typeof Html5Qrcode === 'function' || window.Html5Qrcode) {
        if (!html5QrcodeScanner) html5QrcodeScanner = new (window.Html5Qrcode || Html5Qrcode)(readerId);
        await html5QrcodeScanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, onScanSuccess, onScanFailure);
        if (startBtn && stopBtn) { startBtn.style.display = 'none'; stopBtn.style.display = 'inline-block'; }
      }
    } catch (err) { console.error('Resume scanner failed', err); }
  }

  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    if (!pendingRedirect) return;
    const u = new URL(window.location.origin + '/transfer.html');
    if (pendingRedirect.acct) u.searchParams.set('toAccountNumber', pendingRedirect.acct);
    if (pendingRedirect.bank) u.searchParams.set('bank', pendingRedirect.bank);
    if (pendingRedirect.amount) u.searchParams.set('amount', pendingRedirect.amount);
    if (pendingRedirect.recipName) u.searchParams.set('recipientName', pendingRedirect.recipName);
    window.location.href = u.toString();
  });

  if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', async () => { await resumeScanner(); });

  // Ask for camera permission and open the rear camera on first entry.
  if (scanPane && !scanPane.classList.contains('hidden')) startScanner();

});
