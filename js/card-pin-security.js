document.addEventListener('DOMContentLoaded', async () => {
    const cardSelect = document.getElementById('cardSelect');
    const pinTitle = document.getElementById('pinTitle');
    const pinDescription = document.getElementById('pinDescription');
    const sendCodeButton = document.getElementById('sendCode');
    const resendCodeButton = document.getElementById('resendCode');
    const form = document.getElementById('cardPinForm');
    const status = document.getElementById('pinStatus');
    const initialCardId = new URLSearchParams(window.location.search).get('cardId');

    function setStatus(message, kind = '') {
        status.textContent = message;
        status.className = `pin-status${kind ? ` ${kind}` : ''}`;
    }

    function selectedCard() {
        return cardSelect.selectedOptions[0]?.card || null;
    }

    function updateTitle() {
        const card = selectedCard();
        const isReset = Boolean(card?.pin_configured);
        pinTitle.textContent = isReset ? 'Reset card PIN' : 'Set card PIN';
        pinDescription.textContent = isReset
            ? 'Create a new four-digit PIN for this card after verifying your email.'
            : 'Create a four-digit PIN for this card after verifying your email.';
        sendCodeButton.disabled = !card;
    }

    async function requestCode() {
        const card = selectedCard();
        if (!card) return setStatus('Select an active card first.', 'error');
        sendCodeButton.disabled = true;
        resendCodeButton.disabled = true;
        setStatus('Sending a verification code to your account email...');
        try {
            const result = await apiClient.post('/security/card-pin/request', { cardId: card.id });
            cardSelect.disabled = true;
            form.hidden = false;
            sendCodeButton.hidden = true;
            setStatus(result.message || 'Check your email for the card PIN code.');
            document.getElementById('verificationCode').focus();
        } catch (error) {
            setStatus(error.message || 'Unable to send the verification code.', 'error');
        } finally {
            if (!form.hidden) resendCodeButton.disabled = false;
            else sendCodeButton.disabled = false;
        }
    }

    sendCodeButton.addEventListener('click', requestCode);
    resendCodeButton.addEventListener('click', requestCode);
    cardSelect.addEventListener('change', updateTitle);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const card = selectedCard();
        const code = document.getElementById('verificationCode').value.trim();
        const pin = document.getElementById('newCardPin').value.trim();
        const confirmation = document.getElementById('confirmCardPin').value.trim();
        if (!card) return setStatus('Select a card first.', 'error');
        if (!/^\d{6}$/.test(code)) return setStatus('Enter the six-digit email code.', 'error');
        if (!/^\d{4}$/.test(pin)) return setStatus('Card PIN must be exactly four digits.', 'error');
        if (pin !== confirmation) return setStatus('The card PINs do not match.', 'error');

        const submitButton = document.getElementById('saveCardPin');
        submitButton.disabled = true;
        setStatus('Saving your card PIN...');
        try {
            const result = await apiClient.post('/security/card-pin/confirm', { cardId: card.id, code, pin });
            card.pin_configured = true;
            updateTitle();
            setStatus(result.message || 'Card PIN saved successfully.', 'success');
            form.reset();
            form.hidden = true;
            cardSelect.disabled = false;
            sendCodeButton.hidden = false;
            sendCodeButton.disabled = false;
        } catch (error) {
            setStatus(error.message || 'Unable to save the card PIN.', 'error');
        } finally {
            submitButton.disabled = false;
        }
    });

    try {
        const cards = await cardsAPI.getAll();
        const activeCards = cards.filter(card => String(card.status || 'active').toLowerCase() !== 'blocked');
        cardSelect.replaceChildren(new Option(activeCards.length ? 'Select a card' : 'No cards available', ''));
        activeCards.forEach(card => {
            const suffix = String(card.card_number || '').slice(-4);
            const option = new Option(`${String(card.card_type || 'Card').toUpperCase()} ending in ${suffix}`, card.id);
            option.card = card;
            cardSelect.add(option);
        });
        if (initialCardId && activeCards.some(card => card.id === initialCardId)) cardSelect.value = initialCardId;
        updateTitle();
        if (!activeCards.length) setStatus('You need an available card before you can set a card PIN.', 'error');
    } catch (error) {
        cardSelect.replaceChildren(new Option('Unable to load cards', ''));
        setStatus(error.message || 'Unable to load your cards.', 'error');
    }
});
