// QR page logic: scanner and display user QR

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('authToken')) return window.location.href = 'index.html';

  const scanTab = document.getElementById('scanTab');
  const showTab = document.getElementById('showTab');
  const scanPane = document.getElementById('scanPane');
  const showPane = document.getElementById('showPane');
  const startBtn = document.getElementById('startScan');
  const stopBtn = document.getElementById('stopScan');
  const resultEl = document.getElementById('scanResult');
  const readerId = 'reader';

  let html5QrcodeScanner = null;

  scanTab.addEventListener('click', () => { scanPane.classList.remove('hidden'); showPane.classList.add('hidden'); });
  showTab.addEventListener('click', () => { scanPane.classList.add('hidden'); showPane.classList.remove('hidden'); });

  startBtn.addEventListener('click', async () => {
    startBtn.style.display = 'none'; stopBtn.style.display = 'inline-block';
    try {
      html5QrcodeScanner = new Html5Qrcode(readerId);
      await html5QrcodeScanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, onScanSuccess, onScanFailure);
    } catch (err) {
      console.error('Scanner start failed', err);
      resultEl.textContent = 'Unable to start camera: ' + (err.message || err);
      startBtn.style.display = 'inline-block'; stopBtn.style.display = 'none';
    }
  });

  stopBtn.addEventListener('click', async () => {
    stopBtn.style.display = 'none'; startBtn.style.display = 'inline-block';
    try { if (html5QrcodeScanner) await html5QrcodeScanner.stop(); } catch(e) { console.error(e); }
  });

  function onScanSuccess(decodedText, decodedResult) {
    // show the raw result
    resultEl.textContent = decodedText;
    // try to parse JSON payloads used by bank QR codes
    let payload = null;
    try { payload = JSON.parse(decodedText); } catch (e) { payload = null; }

    // If payload contains accountNumber or iban, navigate to transfer page with params
    if (payload && (payload.accountNumber || payload.iban || payload.account_number)) {
      const acct = payload.accountNumber || payload.iban || payload.account_number;
      const bank = payload.bankName || payload.bank || payload.bank_name || '';
      const amount = payload.amount || '';
      // stop scanner
      if (html5QrcodeScanner) html5QrcodeScanner.stop();
      // Redirect to transfer page with prefilled params
      const u = new URL(window.location.origin + '/transfer.html');
      if (acct) u.searchParams.set('toAccountNumber', acct);
      if (bank) u.searchParams.set('bank', bank);
      if (amount) u.searchParams.set('amount', amount);
      window.location.href = u.toString();
      return;
    }

    // Otherwise treat decodedText as account number or deeplink — redirect to transfer with account number
    if (!payload && decodedText) {
      if (html5QrcodeScanner) html5QrcodeScanner.stop();
      const u = new URL(window.location.origin + '/transfer.html');
      u.searchParams.set('toAccountNumber', decodedText);
      window.location.href = u.toString();
    }
  }

  function onScanFailure(error) {
    // console.log('scan failure', error);
  }

  // Generate user's QR for receiving deposits
  try {
    // attempt to get user primary account via accountsAPI if available, else fallback to local storage helper
    let accountNumber = '';
    if (window.accountsAPI && typeof window.accountsAPI.getAll === 'function') {
      try {
        const accs = await window.accountsAPI.getAll();
        if (accs && accs.length) accountNumber = accs[0].account_number || accs[0].accountNumber || '';
      } catch (e) { /* ignore */ }
    }
    if (!accountNumber && window.getUserAccounts) {
      try { const user = getCurrentUser(); const accs = getUserAccounts(user.id); if (accs && accs.length) accountNumber = accs[0].accountNumber || accs[0].account_number || accs[0].accountNumber; } catch(e){}
    }

    const payload = { bank: 'American Bank United', accountNumber: accountNumber, note: 'ABU deposit' };
    const container = document.getElementById('myQrContainer');
    container.innerHTML = '';
    new QRCode(container, { text: JSON.stringify(payload), width: 200, height: 200 });
  } catch (e) { console.error('QR gen failed', e); }

});
