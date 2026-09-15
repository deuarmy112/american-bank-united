(function () {
    let chatLoaded = false;
    let customerMessages = [];

    function escapeChatText(value) {
        return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
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
            if (status) status.textContent = '';
            chatLoaded = true;
        } catch (error) {
            if (status) status.textContent = error.message || 'Unable to load chat.';
        }
    }

    window.loadCustomerChat = loadCustomerChat;

    window.openCustomerServiceModal = function () {
        const modal = document.getElementById('modal-cs');
        if (!modal) return;
        modal.classList.remove('hidden');
        if (!chatLoaded) loadCustomerChat();
    };

    window.closeCustomerServiceModal = function () {
        document.getElementById('modal-cs')?.classList.add('hidden');
    };

    document.addEventListener('DOMContentLoaded', () => {
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
