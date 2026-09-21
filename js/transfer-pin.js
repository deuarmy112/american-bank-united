(function () {
    let modal;

    function getModal() {
        if (modal) return modal;
        modal = document.createElement('div');
        modal.innerHTML = `<div style="position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55);"><div style="width:100%;max-width:390px;background:#fff;border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(15,23,42,.25);"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;"><div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700;">Secure transfer</div><h2 id="transferPinTitle" style="margin:4px 0 0;font-size:20px;color:#0f172a;">Enter transfer PIN</h2></div><button type="button" id="transferPinClose" aria-label="Close" style="border:0;background:transparent;color:#64748b;font-size:22px;">&times;</button></div><p id="transferPinMessage" style="color:#475569;font-size:14px;line-height:1.5;margin:12px 0 16px;"></p><form id="transferPinForm"><input id="transferPinInput" inputmode="numeric" autocomplete="one-time-code" maxlength="4" pattern="[0-9]{4}" required style="width:100%;font-size:24px;letter-spacing:.4em;text-align:center;border:1px solid #cbd5e1;border-radius:10px;padding:11px;color:#0f172a;" placeholder="••••"><p id="transferPinError" style="min-height:20px;color:#dc2626;font-size:13px;margin:8px 0;"></p><button type="submit" style="width:100%;border:0;border-radius:10px;padding:12px;background:#172033;color:#fff;font-weight:700;">Continue</button></form></div></div>`;
        document.body.appendChild(modal);
        return modal;
    }

    function askPin(configured) {
        const root = getModal();
        const title = root.querySelector('#transferPinTitle');
        const message = root.querySelector('#transferPinMessage');
        const input = root.querySelector('#transferPinInput');
        const error = root.querySelector('#transferPinError');
        const form = root.querySelector('#transferPinForm');
        const close = root.querySelector('#transferPinClose');
        title.textContent = configured ? 'Enter transfer PIN' : 'Set transfer PIN';
        message.textContent = configured ? 'Enter your 4-digit PIN to authorize this transaction.' : 'Create a 4-digit PIN. You will need it for every transfer and withdrawal.';
        input.value = '';
        error.textContent = '';
        root.style.display = 'block';
        input.focus();
        return new Promise(resolve => {
            const finish = value => { root.style.display = 'none'; form.onsubmit = null; close.onclick = null; resolve(value); };
            close.onclick = () => finish(null);
            form.onsubmit = async event => {
                event.preventDefault();
                const pin = input.value.trim();
                if (!/^\d{4}$/.test(pin)) { error.textContent = 'Enter exactly 4 digits.'; return; }
                try {
                    if (!configured) {
                        const confirmPin = window.prompt('Re-enter your 4-digit transfer PIN to confirm');
                        if (confirmPin !== pin) { error.textContent = 'PINs do not match.'; return; }
                        await apiClient.post('/transfer-pin', { pin });
                    }
                    finish(pin);
                } catch (requestError) { error.textContent = requestError.message || 'PIN verification failed.'; }
            };
        });
    }

    window.requireTransferPin = async function () {
        try {
            const status = await apiClient.get('/transfer-pin');
            return askPin(Boolean(status.configured));
        } catch (error) {
            if (error.status === 403) showAlert(error.message || 'Your account is restricted.', 'error');
            else showAlert(error.message || 'Unable to prepare transfer security.', 'error');
            return null;
        }
    };
})();
