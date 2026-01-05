/* 
 * Dashboard Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    if (!requireAuth()) return;
    
    // Display user info
    await displayUserName();
    
    // Load dashboard data
    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        const [accounts, transactions] = await Promise.all([
            accountsAPI.getAll(),
            transactionsAPI.getAll()
        ]);
        
        // Calculate total balance
        const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
        document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
        
        // Display account count
        document.getElementById('totalAccounts').textContent = accounts.length;
        
        // Display transaction count
        document.getElementById('totalTransactions').textContent = transactions.length;
        
        // Calculate monthly activity (transactions in current month)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyTransactions = transactions.filter(txn => {
            const txnDate = new Date(txn.created_at);
            return txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear;
        });
        
        const monthlyAmount = monthlyTransactions.reduce((sum, txn) => {
            if (txn.type === 'deposit' || txn.type === 'transfer') {
                return sum + parseFloat(txn.amount);
            }
            return sum;
        }, 0);
        
        document.getElementById('monthlyActivity').textContent = formatCurrency(monthlyAmount);
        
        // Load accounts
        loadDashboardAccounts(accounts);

        // Set current account display (respect selectedAccountId if present)
        if (accounts && accounts.length > 0) {
            const selectedId = localStorage.getItem('selectedAccountId');
            const acct = (selectedId ? accounts.find(a => a.id === selectedId) : null) || accounts[0];
            const labelEl = document.getElementById('currentAccountLabel');
            const availEl = document.getElementById('currentAccountAvailable');
            if (labelEl) labelEl.textContent = `${capitalize(acct.account_type)} • ****${acct.account_number.slice(-4)}`;
            if (availEl) availEl.textContent = formatCurrency(acct.balance);
        }

        // Start accounts carousel autoplay
        startAccountsCarousel();

        // Load recent transactions (last 6)
        loadRecentTransactions(transactions.slice(0, 6));
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showAlert('Failed to load dashboard data', 'error');
    }
}

function loadDashboardAccounts(accounts) {
    const accountsList = document.getElementById('accountsList');
    
    if (accounts.length === 0) {
        accountsList.innerHTML = '<p class="no-data">No accounts yet. <a href="accounts.html">Create your first account</a></p>';
        return;
    }
    
    accountsList.innerHTML = '';
    
    accounts.forEach(account => {
        const card = document.createElement('div');
        card.className = 'min-w-[220px] flex-none bg-white rounded-xl p-4 shadow flex flex-col gap-2';
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-xs text-slate-500">${capitalize(account.account_type)} • ****${account.account_number.slice(-4)}</p>
                    <p class="text-lg font-semibold mt-2">${formatCurrency(account.balance)}</p>
                </div>
                <div class="text-slate-400"> <i class="fas fa-wallet text-2xl"></i> </div>
            </div>
            <div class="mt-2 text-xs text-slate-500">Available balance</div>
        `;
        accountsList.appendChild(card);
    });
}

let _carouselInterval = null;
function startAccountsCarousel() {
    const el = document.getElementById('accountsList');
    if (!el) return;
    // clear existing
    if (_carouselInterval) clearInterval(_carouselInterval);

    const scrollStep = () => {
        if (el.scrollWidth <= el.clientWidth) return; // no scroll needed
        const card = el.querySelector(':scope > *');
        if (!card) return;
        const cardWidth = card.clientWidth + 12; // include gap
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (Math.ceil(el.scrollLeft + cardWidth) > maxScroll) {
            // loop back
            el.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            el.scrollBy({ left: cardWidth, behavior: 'smooth' });
        }
    };

    _carouselInterval = setInterval(scrollStep, 3000);
    // pause on hover/touch
    el.addEventListener('mouseenter', () => clearInterval(_carouselInterval));
    el.addEventListener('mouseleave', () => { if (_carouselInterval) clearInterval(_carouselInterval); _carouselInterval = setInterval(scrollStep, 3000); });
}

function loadRecentTransactions(transactions) {
    const transactionsList = document.getElementById('recentTransactions');
    
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p class="no-data">No recent transactions</p>';
        return;
    }
    
    transactionsList.innerHTML = '';
    
    transactions.forEach(txn => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded-lg p-3 shadow flex items-center justify-between';

        let iconClass = 'fas fa-exchange-alt text-slate-600';
        let amountSign = '-';
        let amountColor = 'text-slate-700';
        if (txn.type === 'deposit') { iconClass = 'fas fa-arrow-down text-green-500'; amountSign = '+'; amountColor='text-green-600'; }
        if (txn.type === 'withdrawal') { iconClass = 'fas fa-arrow-up text-rose-500'; amountSign='-'; amountColor='text-rose-600'; }
        if (txn.type === 'transfer') { iconClass = 'fas fa-exchange-alt text-indigo-500'; amountSign='-'; amountColor='text-slate-700'; }
        if (txn.type === 'bill_payment') { iconClass = 'fas fa-file-invoice-dollar text-yellow-500'; amountSign='-'; amountColor='text-slate-700'; }

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                    <i class="${iconClass} text-lg"></i>
                </div>
                <div>
                    <div class="text-sm font-medium">${txn.description || capitalize(txn.type)}</div>
                    <div class="text-xs text-slate-400">${formatDate(txn.created_at)}</div>
                </div>
            </div>
            <div class="text-sm font-semibold ${amountColor}">${amountSign}${formatCurrency(txn.amount)}</div>
        `;

        transactionsList.appendChild(item);
    });
}
