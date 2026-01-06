/* Wallet page script */

document.addEventListener('DOMContentLoaded', async function(){
    if (typeof requireAuth === 'function' && !requireAuth()) return;
    if (typeof displayUserName === 'function') await displayUserName();
    await loadWallets();
});

async function loadWallets(){
    const container = document.getElementById('walletsList');
    const totalEl = document.getElementById('walletTotal');
    if (!container) return;
    container.innerHTML = '<div class="text-xs text-slate-500">Loading wallets...</div>';
    try{
        const wallets = await walletsAPI.getAll();
        if (!Array.isArray(wallets) || wallets.length === 0){
            container.innerHTML = '<div class="text-xs text-slate-500">No linked wallets</div>';
            if (totalEl) totalEl.textContent = '$0.00';
            return;
        }
        let total = 0;
        container.innerHTML = '';
        wallets.forEach(w=>{
            const bal = parseFloat(w.balance) || 0;
            total += bal;
            const el = document.createElement('div');
            el.className = 'p-3 opay-card flex items-center justify-between';
            el.innerHTML = `<div>
                <div class="font-medium">${w.currency?.toUpperCase() || 'CRYPTO'} • ${shortAddress(w.address)}</div>
                <div class="text-xs text-slate-500">${w.note || ''}</div>
            </div>
            <div class="text-right">
                <div class="font-semibold">${formatCurrency(bal)}</div>
                <div class="text-xs text-slate-500">${w.confirmed ? 'Linked' : 'Pending'}</div>
                <div class="mt-2 flex gap-2">
                    <button class="opay-btn" onclick='openSendModal(${JSON.stringify(w)})'>Send</button>
                    <button class="border px-3 py-1 rounded-md" onclick='viewWalletTxs("${w.id}")'>Txs</button>
                </div>
            </div>`;
            container.appendChild(el);
        });
        if (totalEl) totalEl.textContent = formatCurrency(total);
    }catch(err){
        console.error('Load wallets failed', err);
        container.innerHTML = '<div class="text-xs text-rose-600">Failed to load wallets</div>';
    }
}

function shortAddress(addr){
    if (!addr) return '';
    return addr.length>12? addr.slice(0,6) + '...' + addr.slice(-4): addr;
}

function openLinkWalletModal(){
    const m = document.getElementById('linkWalletModal');
    if (!m) return; m.classList.remove('hidden'); m.classList.add('flex');
}
function closeLinkWalletModal(){
    const m = document.getElementById('linkWalletModal'); if (!m) return; m.classList.add('hidden'); m.classList.remove('flex');
}

// Link wallet handler
document.getElementById('linkWalletForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const address = document.getElementById('linkAddress').value.trim();
    const currency = document.getElementById('linkCurrency').value.trim();
    const note = document.getElementById('linkNote').value.trim();
    if (!address || !currency){ showAlert('Provide address and currency','error'); return; }
    try{
        const btn = e.target.querySelector('button[type=submit]'); btn.textContent='Linking...'; btn.disabled=true;
        await walletsAPI.linkWallet({ address, currency, note });
        showAlert('Wallet linked','success');
        closeLinkWalletModal();
        await loadWallets();
    }catch(err){ console.error(err); showAlert(err.message||'Failed to link wallet','error'); }
    finally{ const btn = e.target.querySelector('button[type=submit]'); if(btn){btn.textContent='Link Wallet';btn.disabled=false;} }
});

// Send modal
function openSendModal(wallet){
    const m = document.getElementById('sendWalletModal'); if(!m) return; m.classList.remove('hidden'); m.classList.add('flex');
    document.getElementById('sendFromLabel').textContent = `${wallet.currency?.toUpperCase()} • ${shortAddress(wallet.address)}`;
    document.getElementById('sendFromId').value = wallet.id;
}
function closeSendModal(){ const m = document.getElementById('sendWalletModal'); if(!m) return; m.classList.add('hidden'); m.classList.remove('flex'); }

// send handler
document.getElementById('sendWalletForm')?.addEventListener('submit', async function(e){
    e.preventDefault();
    const fromId = document.getElementById('sendFromId').value;
    const toAddress = document.getElementById('sendToAddress').value.trim();
    const amount = parseFloat(document.getElementById('sendAmount').value);
    const memo = document.getElementById('sendMemo').value.trim();
    if (!fromId || !toAddress || !amount || amount<=0) { showAlert('Provide all details','error'); return; }
    try{
        const btn = e.target.querySelector('button[type=submit]'); btn.textContent='Sending...'; btn.disabled=true;
        await walletsAPI.send(fromId,{ toAddress, amount, memo });
        showAlert('Send submitted','success');
        closeSendModal();
        await loadWallets();
    }catch(err){ console.error(err); showAlert(err.message||'Send failed','error'); }
    finally{ const btn = e.target.querySelector('button[type=submit]'); if(btn){btn.textContent='Send';btn.disabled=false;} }
});

async function viewWalletTxs(walletId){
    const wrap = document.getElementById('walletTxs'); if(!wrap) return;
    wrap.innerHTML = '<div class="text-xs text-slate-500">Loading...</div>';
    try{
        const txs = await walletsAPI.getTransactions(walletId);
        if(!txs || txs.length===0){ wrap.innerHTML = '<div class="text-xs text-slate-500">No transactions</div>'; return; }
        wrap.innerHTML = '';
        txs.slice(0,8).forEach(t=>{
            const el = document.createElement('div'); el.className='flex justify-between items-center border-b pb-2 mb-2';
            el.innerHTML = `<div class="text-sm">${t.to || shortAddress(t.address)}</div><div class="text-sm font-semibold">${formatCurrency(t.amount)}</div>`;
            wrap.appendChild(el);
        });
    }catch(err){ console.error(err); wrap.innerHTML = '<div class="text-xs text-rose-600">Failed to load</div>'; }
}
