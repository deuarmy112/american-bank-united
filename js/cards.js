/*
 * Cards Page Script
 */

document.addEventListener('DOMContentLoaded', function() {
    if (!requireAuth()) return;
    displayUserName();
    loadCards();

    const requestCardForm = document.getElementById('requestCardForm');
    if (requestCardForm) requestCardForm.addEventListener('submit', handleRequestCard);
    const logoutBtn = document.getElementById('cardsLogout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        if (confirm('Logout?')) {
            localStorage.removeItem('authToken');
            window.location.href = 'index.html';
        }
    });
});

function loadCards() {
    const user = getCurrentUser();
    const cards = getUserCards(user.id);
    const cardsList = document.getElementById('cardsList');

    // Create a system-generated virtual card preview (not yet persisted)
    const virtualCard = createVirtualCardObject(user);

    // Combine virtual preview with user's linked cards; virtual goes first
    const allCards = [virtualCard].concat(cards);

    if (allCards.length === 0) {
        cardsList.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-lg border-2 border-dashed border-slate-300">
                <i class="fas fa-credit-card text-6xl text-slate-300 mb-4"></i>
                <h3 class="text-xl font-semibold text-slate-700 mb-2">No Cards Yet</h3>
                <p class="text-slate-500 mb-6">Request your first card to start making payments</p>
                <button onclick="showRequestCardModal()" class="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                    <i class="fas fa-plus mr-2"></i> Request Card
                </button>
            </div>
        `;
        return;
    }

    const html = allCards.map(card => {
        const account = getAccountById(card.linkedAccountId);
        const cardColors = {
            classic: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            platinum: 'linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)',
            gold: 'linear-gradient(135deg, #FFD89B 0%, #19547B 100%)',
            black: 'linear-gradient(135deg, #434343 0%, #000000 100%)'
        };

        const virtualBadge = card.isVirtual ? '<div class="card-virtual-badge">Virtual</div>' : '';
        const linkedLabel = card.isVirtual ? 'Virtual Wallet' : (account ? capitalize(account.accountType) : 'N/A');

        return `
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                <div class="absolute top-4 left-4 w-8 h-6 bg-yellow-400 rounded opacity-80"></div>
                <div class="flex justify-between items-start mb-8">
                    <div class="text-sm opacity-80">${capitalize(card.cardType)} Card</div>
                    ${card.isVirtual ? '<div class="bg-purple-500 text-xs px-2 py-1 rounded">Virtual</div>' : ''}
                </div>
                <div class="text-xl font-mono tracking-wider mb-6">
                    **** **** **** ${card.cardNumber.slice(-4)}
                </div>
                <div class="flex justify-between items-end">
                    <div>
                        <div class="text-xs opacity-70">CARDHOLDER</div>
                        <div class="font-semibold">${user.firstName.toUpperCase()} ${user.lastName.toUpperCase()}</div>
                    </div>
                    <div>
                        <div class="text-xs opacity-70">EXPIRES</div>
                        <div class="font-semibold">${formatCardExpiry(card.expiryDate)}</div>
                    </div>
                </div>
                <div class="mt-4 flex justify-between items-center text-sm">
                    <div class="opacity-80">
                        <span class="text-xs">Linked:</span> ${card.isVirtual ? 'Virtual Wallet' : (account ? capitalize(account.accountType) : 'N/A')}
                    </div>
                    <div class="px-2 py-1 rounded text-xs font-semibold ${
                        card.status === 'active' ? 'bg-green-500' :
                        card.status === 'inactive' ? 'bg-red-500' :
                        'bg-yellow-500'
                    }">${(card.status || 'unknown').toUpperCase()}</div>
                </div>
            </div>
        `;
    }).join('');

    cardsList.innerHTML = html;

    loadCardTransactions(cards);
}

function loadCardTransactions(cards) {
    const container = document.getElementById('cardTransactions');
    const cardIds = cards.map(c => c.id);
    const transactions = getTransactions().filter(txn =>
        cardIds.includes(txn.cardId)
    ).slice(0, 10);

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <i class="fas fa-credit-card text-4xl mb-4 text-slate-300"></i>
                <p>No card transactions yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(txn => `
        <div class="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <i class="fas fa-credit-card text-indigo-600"></i>
                </div>
                <div>
                    <div class="font-medium text-slate-900">${txn.description || 'Card Purchase'}</div>
                    <div class="text-sm text-slate-500">${formatDate(txn.createdAt)}</div>
                </div>
            </div>
            <div class="text-lg font-semibold text-red-600">-${formatCurrency(txn.amount)}</div>
        </div>
    `).join('');
}

function showRequestCardModal() {
    const user = getCurrentUser();
    const accounts = getUserAccounts(user.id);
    const select = document.getElementById('linkedAccount');

    select.innerHTML = '<option value="">Select account</option>';
    accounts.forEach(acc => {
        select.innerHTML += `<option value="${acc.id}">${capitalize(acc.accountType)} - ${acc.accountNumber}</option>`;
    });

    document.getElementById('requestCardModal').classList.remove('hidden');
    document.getElementById('requestCardModal').classList.add('flex');
}

function closeRequestCardModal() {
    document.getElementById('requestCardModal').classList.add('hidden');
    document.getElementById('requestCardModal').classList.remove('flex');
    const form = document.getElementById('requestCardForm'); if (form) form.reset();
}

function handleRequestCard(e) {
    e.preventDefault();

    const cardType = document.getElementById('cardType').value;
    const linkedAccount = document.getElementById('linkedAccount').value;
    const cardDesign = document.getElementById('cardDesign').value;

    const user = getCurrentUser();

    const newCard = addCard(user.id, {
        cardType,
        linkedAccountId: linkedAccount,
        design: cardDesign
    });

    showAlert(`${capitalize(cardType)} card requested successfully! It will be delivered in 5-7 business days.`, 'success');
    closeRequestCardModal();
    loadCards();
}

function formatCardExpiry(dateString) {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
}

// Create an in-memory virtual card object for preview
function createVirtualCardObject(user) {
    const now = new Date();
    const expiry = new Date(); expiry.setFullYear(now.getFullYear() + 2);
    const cardNumber = '9' + Math.floor(1000 + Math.random() * 9000).toString() + Math.floor(1000 + Math.random() * 9000).toString() + Math.floor(1000 + Math.random() * 9000).toString();
    return {
        id: 'virtual-' + Date.now(),
        userId: user.id,
        cardNumber: cardNumber,
        cardType: 'virtual',
        linkedAccountId: null,
        design: 'platinum',
        status: 'virtual',
        expiryDate: expiry.toISOString(),
        cvv: '***',
        isVirtual: true,
        createdAt: now.toISOString()
    };
}

// Persist a generated virtual card for the current user
function generateVirtualCardForUser() {
    const user = getCurrentUser();
    if (!user) return alert('Please sign in');
    // create and persist using existing addCard (it will generate a card number and cvv)
    addCard(user.id, {
        cardType: 'virtual-debit',
        linkedAccountId: '',
        design: 'platinum'
    });
    loadCards();
    showAlert('Virtual card generated and added to your cards', 'success');
}

window.onclick = function(event) {
    const modal = document.getElementById('requestCardModal');
    if (event.target === modal) {
        closeRequestCardModal();
    }
}

// Expose generate function globally
window.generateVirtualCardForUser = generateVirtualCardForUser;
/* 
 * Cards Page Script
 */

document.addEventListener('DOMContentLoaded', function() {
    if (!requireAuth()) return;
    displayUserName();
    loadCards();
    
    const requestCardForm = document.getElementById('requestCardForm');
    requestCardForm.addEventListener('submit', handleRequestCard);
});

function loadCards() {
    const user = getCurrentUser();
    const cards = getUserCards(user.id);
    const cardsList = document.getElementById('cardsList');
    
    if (cards.length === 0) {
        cardsList.innerHTML = `
            <div class="card text-center" style="grid-column: 1/-1; padding: 40px;">
                <i class="fas fa-credit-card" style="font-size: 64px; color: #ccc; margin-bottom: 20px;"></i>
                <h3>No Cards Yet</h3>
                <p>Request your first card to start making payments</p>
                <button onclick="showRequestCardModal()" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-plus"></i> Request Card
                </button>
            </div>
        `;
        return;
    }
    
    cardsList.innerHTML = cards.map(card => {
        const account = getAccountById(card.linkedAccountId);
        const cardColors = {
            classic: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            platinum: 'linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)',
            gold: 'linear-gradient(135deg, #FFD89B 0%, #19547B 100%)',
            black: 'linear-gradient(135deg, #434343 0%, #000000 100%)'
        };
        
        return `
            <div class="credit-card" style="background: ${cardColors[card.design] || cardColors.classic}">
                <div class="card-chip"><i class="fas fa-microchip"></i></div>
                <div class="card-type">${capitalize(card.cardType)} Card</div>
                <div class="card-number">
                    **** **** **** ${card.cardNumber.slice(-4)}
                </div>
                <div class="card-details">
                    <div>
                        <small>CARDHOLDER</small>
                        <div>${user.firstName.toUpperCase()} ${user.lastName.toUpperCase()}</div>
                    </div>
                    <div>
                        <small>EXPIRES</small>
                        <div>${formatCardExpiry(card.expiryDate)}</div>
                    </div>
                </div>
                <div class="card-footer">
                    <div><small>Linked:</small> ${account ? capitalize(account.accountType) : 'N/A'}</div>
                    <div class="card-status-badge ${card.status}">${card.status.toUpperCase()}</div>
                </div>
            </div>
        `;
    }).join('');
    
    loadCardTransactions(cards);
}

function loadCardTransactions(cards) {
    const container = document.getElementById('cardTransactions');
    const cardIds = cards.map(c => c.id);
    const transactions = getTransactions().filter(txn => 
        cardIds.includes(txn.cardId)
    ).slice(0, 10);
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p>No card transactions yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(txn => `
        <div class="transaction-item">
            <div class="transaction-icon"><i class="fas fa-credit-card"></i></div>
            <div class="transaction-details">
                <div class="transaction-type">${txn.description || 'Card Purchase'}</div>
                <div class="transaction-date">${formatDate(txn.createdAt)}</div>
            </div>
            <div class="transaction-amount debit">-${formatCurrency(txn.amount)}</div>
        </div>
    `).join('');
}

function showRequestCardModal() {
    const user = getCurrentUser();
    const accounts = getUserAccounts(user.id);
    const select = document.getElementById('linkedAccount');
    
    select.innerHTML = '<option value="">Select account</option>';
    accounts.forEach(acc => {
        select.innerHTML += `<option value="${acc.id}">${capitalize(acc.accountType)} - ${acc.accountNumber}</option>`;
    });
    
    document.getElementById('requestCardModal').style.display = 'block';
}

function closeRequestCardModal() {
    document.getElementById('requestCardModal').style.display = 'none';
    document.getElementById('requestCardForm').reset();
}

function handleRequestCard(e) {
    e.preventDefault();
    
    const cardType = document.getElementById('cardType').value;
    const linkedAccount = document.getElementById('linkedAccount').value;
    const cardDesign = document.getElementById('cardDesign').value;
    
    const user = getCurrentUser();
    
    const newCard = addCard(user.id, {
        cardType,
        linkedAccountId: linkedAccount,
        design: cardDesign
    });
    
    showAlert(`${capitalize(cardType)} card requested successfully! It will be delivered in 5-7 business days.`, 'success');
    closeRequestCardModal();
    loadCards();
}

function formatCardExpiry(dateString) {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
}

window.onclick = function(event) {
    const modal = document.getElementById('requestCardModal');
    if (event.target === modal) {
        closeRequestCardModal();
    }
}
