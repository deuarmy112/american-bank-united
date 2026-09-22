(function () {
    let chatLoaded = false;
    let chatStarting = false;
    let customerMessages = [];

    function escapeChatText(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    function formatChatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
    }

    function renderChatMessages(messages) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        container.innerHTML = messages.length
            ? messages.map(message => `<div data-message="${escapeChatText(message.text)}" data-role="${message.sender_role}" class="${message.sender_role === 'customer' ? 'text-right' : 'text-left'}"><span class="inline-block max-w-[85%] rounded px-3 py-2 ${message.sender_role === 'customer' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-700'}">${escapeChatText(message.text)}</span><div class="text-[10px] text-slate-400 mt-1">${message.sender_role === 'customer' ? 'You' : 'Bank support'}</div></div>`).join('')
            : '<p class="text-center text-slate-400 py-8">Start a conversation with bank support.</p>';
        container.scrollTop = container.scrollHeight;
    }

    async function loadCustomerChat() {
        const status = document.getElementById('chatStatus');
        if (status) status.textContent = 'Loading conversation...';
        try {
            const data = await apiClient.get('/chat');
            customerMessages = data.messages || [];
            renderChatMessages(customerMessages);
            const unread = document.getElementById('customerUnreadCount');
            if (unread) {
                unread.textContent = data.unreadCount || '';
                unread.classList.toggle('hidden', !data.unreadCount);
            }
            if (status) status.textContent = '';
            chatLoaded = true;
        } catch (error) {
            if (status) status.textContent = error.message || 'Unable to load chat.';
        }
    }

    window.loadCustomerChat = loadCustomerChat;

    function enterFullScreenChat(inquiry) {
        document.body.classList.add('support-chat-fullscreen');
        const purpose = document.getElementById('activeChatPurpose');
        if (purpose) purpose.textContent = inquiry || 'Support conversation';
    }

    window.prepareCustomerChat = function () {
        const inquiryStep = document.getElementById('chatInquiryStep');
        const room = document.getElementById('chatRoom');
        const status = document.getElementById('chatStatus');
        if (!inquiryStep || !room || chatStarting) return;
        inquiryStep.classList.remove('hidden');
        room.classList.add('hidden');
        document.getElementById('existingChatPicker')?.classList.add('hidden');
        document.getElementById('chatProgress')?.classList.add('hidden');
        const progressBar = document.getElementById('chatProgressBar');
        if (progressBar) progressBar.style.width = '0%';
        const startButton = document.getElementById('startChatButton');
        if (startButton) startButton.disabled = false;
        if (status) status.textContent = '';
        loadCustomerChat();
    };

    async function openExistingChat() {
        const picker = document.getElementById('existingChatPicker');
        const list = document.getElementById('existingChatList');
        const status = document.getElementById('chatStatus');
        try {
            const data = await apiClient.get('/chat');
            if (!data.conversation) {
                if (status) status.textContent = 'No existing conversation yet. Select an inquiry to start one.';
                return;
            }
            const conversation = data.conversation;
            list.innerHTML = `<button type="button" id="savedChatChoice" class="w-full text-left border rounded p-3 hover:bg-slate-50"><div class="font-medium">${escapeChatText(conversation.inquiry || 'Support inquiry')}</div><div class="text-xs text-slate-500 mt-1">${escapeChatText(conversation.last_message || 'No messages yet')}</div><div class="text-[10px] text-slate-400 mt-1">${formatChatDate(conversation.last_message_at || conversation.updated_at)}${data.unreadCount ? ` · ${data.unreadCount} unread` : ''}</div></button>`;
            picker.classList.remove('hidden');
            document.getElementById('savedChatChoice').addEventListener('click', async () => {
                const inquiryStep = document.getElementById('chatInquiryStep');
                const room = document.getElementById('chatRoom');
                customerMessages = data.messages || [];
                renderChatMessages(customerMessages);
                await apiClient.post('/chat/read', {});
                document.getElementById('customerUnreadCount')?.classList.add('hidden');
                picker.classList.add('hidden');
                inquiryStep.classList.add('hidden');
                enterFullScreenChat(conversation.inquiry || 'Support conversation');
                room.classList.remove('hidden');
                if (status) status.textContent = `Support chat: ${conversation.inquiry || 'Existing inquiry'}`;
            });
            if (status) status.textContent = 'Select a saved chat to continue.';
        } catch (error) {
            if (status) status.textContent = error.message || 'Unable to open chat.';
        }
    }

    async function startCustomerChat() {
        const inquiry = document.getElementById('chatInquiry')?.value;
        const progress = document.getElementById('chatProgress');
        const progressBar = document.getElementById('chatProgressBar');
        const status = document.getElementById('chatStatus');
        const inquiryStep = document.getElementById('chatInquiryStep');
        const room = document.getElementById('chatRoom');
        if (!inquiry) {
            if (status) status.textContent = 'Select an inquiry to continue.';
            return;
        }
        chatStarting = true;
        document.getElementById('startChatButton').disabled = true;
        progress?.classList.remove('hidden');
        if (progressBar) progressBar.style.width = '35%';
        try {
            const result = await apiClient.post('/chat/start', { inquiry });
            if (progressBar) progressBar.style.width = '100%';
            enterFullScreenChat(inquiry);
            customerMessages = result.messages || [];
            renderChatMessages(customerMessages);
            await apiClient.post('/chat/read', {});
            document.getElementById('customerUnreadCount')?.classList.add('hidden');
            inquiryStep.classList.add('hidden');
            room.classList.remove('hidden');
            if (status) status.textContent = `Support chat: ${inquiry}`;
            chatLoaded = true;
        } catch (error) {
            if (status) status.textContent = error.message || 'Unable to open chat.';
            progress?.classList.add('hidden');
            document.getElementById('startChatButton').disabled = false;
        } finally {
            chatStarting = false;
        }
    }

    window.openCustomerServiceModal = function () {
        const modal = document.getElementById('modal-cs');
        if (!modal) return;
        modal.classList.remove('hidden');
        prepareCustomerChat();
    };

    window.closeCustomerServiceModal = function () {
        document.getElementById('modal-cs')?.classList.add('hidden');
        document.body.classList.remove('support-chat-fullscreen');
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('startChatButton')?.addEventListener('click', startCustomerChat);
        document.getElementById('openExistingChat')?.addEventListener('click', openExistingChat);
        document.getElementById('openExistingChatTop')?.addEventListener('click', openExistingChat);
        if (new URLSearchParams(window.location.search).get('openSupport') === '1') {
            window.openCustomerServiceModal();
        }
        const form = document.getElementById('chatForm');
        if (!form) return;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const input = document.getElementById('chatInput');
            const status = document.getElementById('chatStatus');
            const text = input.value.trim();
            if (!text) return;
            input.disabled = true;
            if (status) status.textContent = 'Sending...';
            try {
                const result = await apiClient.post('/chat', { text });
                customerMessages = [...customerMessages, result.message];
                renderChatMessages(customerMessages);
                input.value = '';
                if (status) status.textContent = '';
            } catch (error) {
                if (status) status.textContent = error.message || 'Message failed to send.';
            } finally {
                input.disabled = false;
                input.focus();
            }
        });
    });
})();
