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
