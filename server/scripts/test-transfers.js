// test-transfers.js — lightweight smoke test for transfer endpoints
// Usage: node test-transfers.js
(async function(){
  const base = process.env.BASE_URL || 'http://localhost:5000';
  const log = (tag, msg) => console.log(`[${tag}]`, msg);

  try {
    log('health', `GET ${base}/api/health`);
    const h = await fetch(`${base}/api/health`);
    log('health', `status ${h.status}`);
    const hjson = await h.text();
    log('health', hjson);
  } catch (err) {
    log('health', `failed: ${err.message}`);
  }

  // Attempt unauthenticated calls (will likely 401 if auth required)
  try {
    log('transactions.transfer', `POST ${base}/api/transactions/transfer`);
    const resp = await fetch(`${base}/api/transactions/transfer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromAccountId: '1', toAccountId: '2', amount: 1.23, description: 'smoke-test' })
    });
    log('transactions.transfer', `status ${resp.status}`);
    console.log(await resp.text());
  } catch (err) {
    log('transactions.transfer', `failed: ${err.message}`);
  }

  // External transfers: send-to-bank
  try {
    log('external.send-to-bank', `POST ${base}/api/external-transfers/send-to-bank`);
    const resp = await fetch(`${base}/api/external-transfers/send-to-bank`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromAccountId: '1', recipientName: 'Test', accountNumber: 'DE89370400440532013000', bankName: 'Demo Bank', recipientEmail: 'test@example.com', amount: 5.00 })
    });
    log('external.send-to-bank', `status ${resp.status}`);
    console.log(await resp.text());
  } catch (err) {
    log('external.send-to-bank', `failed: ${err.message}`);
  }

  // External transfers: send-to-user
  try {
    log('external.send-to-user', `POST ${base}/api/external-transfers/send-to-user`);
    const resp = await fetch(`${base}/api/external-transfers/send-to-user`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromAccountId: '1', recipientEmail: 'peer@example.com', amount: 2.00, memo: 'smoke' })
    });
    log('external.send-to-user', `status ${resp.status}`);
    console.log(await resp.text());
  } catch (err) {
    log('external.send-to-user', `failed: ${err.message}`);
  }

  console.log('\nSmoke test finished. Note: authenticated endpoints require a running server and valid auth token.');
})();
