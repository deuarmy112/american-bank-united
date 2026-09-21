(function () {
    function setBadge(element, count) {
        if (!element) return;
        const value = Number(count) || 0;
        element.textContent = value > 99 ? '99+' : value ? String(value) : '';
        element.classList.toggle('hidden', value === 0);
        element.setAttribute('aria-label', value ? `${value} unread` : 'No unread items');
    }

    function addNavBadge(link, id, count) {
        if (!link) return;
        let badge = link.querySelector(`[data-unread-badge="${id}"]`);
        if (!badge) {
            link.classList.add('relative');
            badge = document.createElement('span');
            badge.dataset.unreadBadge = id;
            badge.className = 'unread-nav-badge';
            badge.style.cssText = 'position:absolute;top:-7px;right:-10px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#e11d48;color:#fff;font-size:10px;line-height:16px;text-align:center;font-weight:700;';
            link.appendChild(badge);
        }
        setBadge(badge, count);
    }

    async function loadUserBadges() {
        if (!localStorage.getItem('authToken') || localStorage.getItem('authToken') === 'guest-token' || !window.apiClient) return;
        try {
            const [chat, notifications] = await Promise.all([apiClient.get('/chat'), apiClient.get('/notifications')]);
            const read = new Set(JSON.parse(localStorage.getItem('abu_read_notifications') || '[]').map(String));
            setBadge(document.getElementById('customerUnreadCount'), chat.unreadCount || 0);
            setBadge(document.getElementById('notifBadge'), (notifications || []).filter(item => item.id && !read.has(String(item.id))).length);
            setBadge(document.getElementById('userChatBadge'), chat.unreadCount || 0);
        } catch (error) {
            console.warn('Unread badge refresh failed', error);
        }
    }

    async function loadAdminBadges() {
        if (!localStorage.getItem('adminAuthToken') || !window.adminAPI) return;
        try {
            const [data, accounts, transactions, verifications] = await Promise.all([
                adminAPI.getChatConversations(),
                adminAPI.getPendingAccounts().catch(() => ({ accounts: [] })),
                adminAPI.getPendingTransactions().catch(() => ({ transactions: [] })),
                adminAPI.getVerificationRequests().catch(() => ({ requests: [] }))
            ]);
            const unread = (data.conversations || []).reduce((total, conversation) => total + (Number(conversation.admin_unread_count) || 0), 0);
            const approvals = (accounts.accounts || []).length + (transactions.transactions || []).length + (verifications.requests || []).length;
            addNavBadge(document.querySelector('a[href="admin-chat.html"]'), 'admin-chat', unread);
            addNavBadge(document.querySelector('a[href="admin-approvals.html"]'), 'admin-approvals', approvals);
            setBadge(document.getElementById('adminChatUnreadCount'), unread);
        } catch (error) {
            console.warn('Admin unread badge refresh failed', error);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadUserBadges();
        loadAdminBadges();
        window.setInterval(() => { loadUserBadges(); loadAdminBadges(); }, 15000);
    });
})();
