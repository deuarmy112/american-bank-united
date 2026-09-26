(() => {
    const MAX_FILE_BYTES = 512 * 1024;
    const supportStack = ['support'];
    let messages = [];
    let conversations = [];
    let selectedConversationId = '';

    const escapeText = value => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const setStatus = message => { const element = document.getElementById('supportChatStatus'); if (element) element.textContent = message || ''; };

    function readAttachment(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: reader.result });
            reader.onerror = () => reject(new Error('Unable to read that file.'));
            reader.readAsDataURL(file);
        });
    }

    function attachmentMarkup(message) {
        const attachment = message.attachment;
        if (!attachment?.data) return '';
        const name = escapeText(attachment.name || 'Attached file');
        const data = escapeText(attachment.data);
        const size = `${Math.max(1, Math.round(Number(attachment.size || 0) / 1024))} KB`;
        const preview = /^image\/(jpeg|png|webp|gif)$/i.test(attachment.type || '') ? `<img src="${data}" alt="${name}" loading="lazy" style="display:block;max-width:min(100%,320px);max-height:240px;object-fit:contain;border-radius:8px;margin-top:8px">` : '';
        return `${preview}<a href="${data}" download="${name}" target="_blank" rel="noopener" style="display:block;text-decoration:underline;margin-top:6px">${name} <small>(${size})</small></a>`;
    }

    function renderMessages() {
        const container = document.getElementById('supportChatMessages');
        if (!container) return;
        container.innerHTML = messages.length ? messages.map(message => `<div class="support-chat-message ${message.sender_role}">${escapeText(message.text)}${attachmentMarkup(message)}${message.sender_role === 'customer' ? `<button type="button" data-remove-message="${escapeText(message.id)}" style="display:block;border:0;background:transparent;padding:5px 0 0;text-decoration:underline;font-size:11px;color:inherit">Remove</button>` : ''}<small>${message.sender_role === 'customer' ? 'You' : 'Bank support'}</small></div>`).join('') : '<p style="color:#64748b;text-align:center">Start your conversation with bank support.</p>';
        container.querySelectorAll('[data-remove-message]').forEach(button => button.addEventListener('click', async () => {
            if (!window.confirm('Remove this message and its attachment?')) return;
            button.disabled = true;
            try { await apiClient.request(`/chat/messages/${encodeURIComponent(button.dataset.removeMessage)}`, { method: 'DELETE', body: JSON.stringify({ conversationId: selectedConversationId }) }); messages = messages.filter(message => message.id !== button.dataset.removeMessage); renderMessages(); }
            catch (error) { setStatus(error.message || 'Unable to remove message.'); button.disabled = false; }
        }));
        container.scrollTop = container.scrollHeight;
    }

    function showScreen(screen) {
        const panel = document.getElementById('supportChatPanel');
        const inquiry = document.getElementById('supportInquiryScreen');
        const conversation = document.getElementById('supportConversationScreen');
        const title = document.getElementById('supportChatTitle');
        const open = supportStack.length > 1;
        panel?.classList.toggle('is-open', open);
        document.body.classList.toggle('support-chat-open', open);
        if (inquiry) inquiry.hidden = screen !== 'inquiry';
        if (conversation) conversation.hidden = screen !== 'conversation';
        if (title) title.textContent = screen === 'conversation' ? 'Support conversation' : 'Secure support chat';
    }

    function pushScreen(screen) {
        if (supportStack[supportStack.length - 1] !== screen) supportStack.push(screen);
        showScreen(screen);
    }

    function popScreen() {
        if (supportStack.length > 1) supportStack.pop();
        showScreen(supportStack[supportStack.length - 1]);
    }

    function renderExistingList() {
        const list = document.getElementById('supportExistingList');
        if (!list) return;
        list.innerHTML = conversations.length ? conversations.map(conversation => `<button type="button" data-conversation-id="${escapeText(conversation.id)}" style="text-align:left;border:1px solid var(--support-border);border-radius:10px;background:#fff;padding:10px"><strong>${escapeText(conversation.inquiry || 'Support inquiry')}</strong><small style="display:block;color:#64748b;margin-top:3px">${escapeText(conversation.last_message || 'No messages yet')}</small></button>`).join('') : '<p style="color:#64748b;font-size:12px">No saved conversations yet.</p>';
        list.querySelectorAll('[data-conversation-id]').forEach(button => button.addEventListener('click', () => openConversation(button.dataset.conversationId)));
    }

    async function openConversation(conversationId) {
        setStatus('Loading conversation...');
        try {
            const data = await apiClient.get(`/chat?conversationId=${encodeURIComponent(conversationId)}`);
            selectedConversationId = conversationId;
            messages = data.messages || [];
            renderMessages();
            await apiClient.post('/chat/read', { conversationId });
            pushScreen('conversation');
            setStatus('');
        } catch (error) { setStatus(error.message || 'Unable to load conversation.'); }
    }

    async function openChat() {
        const token = localStorage.getItem('authToken');
        if (!token || token === 'guest-token') {
            window.location.href = 'index.html?returnTo=support.html%3FopenChat%3D1';
            return;
        }
        pushScreen('inquiry');
        try {
            const data = await apiClient.get('/chat');
            conversations = data.conversations || [];
            renderExistingList();
            document.getElementById('supportOpenExisting').disabled = !conversations.length;
        } catch (error) {
            setStatus(error.message || 'Unable to load saved chat.');
        }
    }

    async function startChat() {
        const inquiry = document.getElementById('supportInquiry')?.value;
        if (!inquiry) { setStatus('Select an inquiry to continue.'); return; }
        setStatus('Opening conversation...');
        try {
            const result = await apiClient.post('/chat/start', { inquiry });
            selectedConversationId = result.conversationId || result.conversation?.id || '';
            messages = result.messages || [];
            renderMessages();
            await apiClient.post('/chat/read', { conversationId: selectedConversationId });
            pushScreen('conversation');
            setStatus('');
        } catch (error) { setStatus(error.message || 'Unable to open conversation.'); }
    }

    async function openExisting() {
        if (!conversations.length) { setStatus('No saved conversation yet. Select an inquiry to start one.'); return; }
        renderExistingList();
        setStatus('Select a saved conversation below.');
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('supportChatLink')?.addEventListener('click', event => { event.preventDefault(); openChat(); });
        document.getElementById('supportChatBack')?.addEventListener('click', popScreen);
        document.getElementById('supportStartChat')?.addEventListener('click', startChat);
        document.getElementById('supportOpenExisting')?.addEventListener('click', openExisting);
        document.getElementById('supportChatForm')?.addEventListener('submit', async event => {
            event.preventDefault();
            const input = document.getElementById('supportChatInput');
            const fileInput = document.getElementById('supportChatFile');
            const text = input.value.trim();
            const file = fileInput.files[0];
            if (!text && !file) return;
            if (file && file.size > MAX_FILE_BYTES) { setStatus('Files must be 512 KB or smaller.'); return; }
            input.disabled = true;
            setStatus('Sending...');
            try {
                const result = await apiClient.post('/chat', { conversationId: selectedConversationId, text, attachment: file ? await readAttachment(file) : null });
                messages.push(result.message);
                renderMessages();
                input.value = '';
                fileInput.value = '';
                setStatus('');
            } catch (error) { setStatus(error.message || 'Message failed to send.'); }
            finally { input.disabled = false; input.focus(); }
        });
        if (new URLSearchParams(window.location.search).get('openChat') === '1') openChat();
    });
})();
