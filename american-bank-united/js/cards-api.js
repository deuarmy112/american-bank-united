/* 
 * Cards Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    await displayUserName();
    await loadCards();
});

async function loadCards() {
    try {
        const cards = await cardsAPI.getAll();
        displayCards(cards);
    } catch (error) {
        console.error('Failed to load cards:', error);
        showAlert('Failed to load cards', 'error');
    }
}

function displayCards(cards) {
    const cardsList = document.getElementById('cardsList');
    
    if (cards.length === 0) {
        cardsList.innerHTML = '<p class="no-data">No cards yet. Request your first card below.</p>';
        return;
    }
    
    cardsList.innerHTML = '';
    
    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = `credit-card ${card.design}`;
        
        const cardType = card.card_type.charAt(0).toUpperCase() + card.card_type.slice(1);
        const expiry = new Date(card.expiry_date);
        const expiryStr = `${(expiry.getMonth() + 1).toString().padStart(2, '0')}/${expiry.getFullYear().toString().slice(-2)}`;
        
        cardElement.innerHTML = `
            <div class="card-chip"></div>
            <div class="card-number">${formatCardNumber(card.card_number)}</div>
            <div class="card-details">
                <div>
                    <div class="card-label">Card Type</div>
                    <div class="card-value">${cardType}</div>
                </div>
                <div>
                    <div class="card-label">Valid Thru</div>
                    <div class="card-value">${expiryStr}</div>
                </div>
                <div>
                    <div class="card-label">CVV</div>
                    <div class="card-value">***</div>
                </div>
            </div>
        `;
        
        cardsList.appendChild(cardElement);
    });
}

function formatCardNumber(number) {
    return number.match(/.{1,4}/g).join(' ');
}

// Modal functions
function showRequestCardModal() {
    document.getElementById('requestCardModal').style.display = 'flex';
    loadAccountsForCard();
}

function closeRequestCardModal() {
    document.getElementById('requestCardModal').style.display = 'none';
}

async function loadAccountsForCard() {
    try {
        const accounts = await accountsAPI.getAll();
        const select = document.getElementById('linkedAccount');
        select.innerHTML = '<option value="">Select Account</option>';
        
        accounts.forEach(account => {
            const option = new Option(
                `${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} - ${account.account_number}`,
                account.id
            );
            select.add(option);
        });
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

// Handle request card form
document.getElementById('requestCardForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const cardType = document.getElementById('cardType').value;
    const linkedAccountId = document.getElementById('linkedAccount').value;
    const design = document.getElementById('cardDesign').value;
    
    if (!cardType || !linkedAccountId || !design) {
        showAlert('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;
        
        await cardsAPI.request(cardType, linkedAccountId, design);
        
        showAlert('Card requested successfully!', 'success');
        closeRequestCardModal();
        
        // Reload cards
        await loadCards();
        
        e.target.reset();
        submitBtn.textContent = 'Request Card';
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Failed to request card:', error);
        showAlert(error.message || 'Failed to request card', 'error');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Request Card';
        submitBtn.disabled = false;
    }
});
