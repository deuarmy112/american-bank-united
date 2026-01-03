/* 
 * Bills Payment Page Script
 */

document.addEventListener('DOMContentLoaded', function() {
    if (!requireAuth()) return;
    displayUserName();
    loadBillers();
    loadRecentPayments();
    
    document.getElementById('addBillerForm').addEventListener('submit', handleAddBiller);
    document.getElementById('payBillForm').addEventListener('submit', handlePayBill);
});

function loadBillers() {
    const user = getCurrentUser();
    const billers = getUserBillers(user.id);
    const container = document.getElementById('savedBillers');
    
    if (billers.length === 0) {
        container.innerHTML = `
            <div class="card text-center" style="grid-column: 1/-1; padding: 40px;">
                <i class="fas fa-file-invoice-dollar" style="font-size: 64px; color: #ccc; margin-bottom: 20px;"></i>
                <h3>No Saved Billers</h3>
                <p>Add billers to pay your bills quickly</p>
                <button onclick="showAddBillerModal()" class="btn btn-primary" style="margin-top: 20px;">
                    <i class="fas fa-plus"></i> Add Biller
                </button>
            </div>
        `;
        return;
    }
    
    const categoryIcons = {
        utilities: 'fa-lightbulb',
        internet: 'fa-wifi',
        phone: 'fa-phone',
        insurance: 'fa-shield-alt',
        'credit-card': 'fa-credit-card',
        loan: 'fa-money-bill-wave'
    };
    
    container.innerHTML = billers.map(biller => `
        <div class="biller-card" onclick="openPayBillModal('${biller.id}')">
            <div class="biller-icon">
                <i class="fas ${categoryIcons[biller.category] || 'fa-file-invoice'}"></i>
            </div>
            <div class="biller-info">
                <h4>${biller.nickname || biller.name}</h4>
                <p>${capitalize(biller.category)}</p>
                <small>Account: ${biller.accountNumber}</small>
            </div>
            <button class="btn btn-primary btn-sm">
                <i class="fas fa-paper-plane"></i> Pay
            </button>
        </div>
    `).join('');
}

function loadRecentPayments() {
    const user = getCurrentUser();
    const payments = getUserBillPayments(user.id).slice(0, 10);
    const container = document.getElementById('recentPayments');
    
    if (payments.length === 0) {
        container.innerHTML = `
            <div class="card text-center">
                <p>No bill payments yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = payments.map(payment => {
        const biller = getBillerById(payment.billerId);
        return `
            <div class="transaction-item">
                <div class="transaction-icon"><i class="fas fa-file-invoice-dollar"></i></div>
                <div class="transaction-details">
                    <div class="transaction-type">${biller ? biller.name : 'Bill Payment'}</div>
                    <div class="transaction-description">${payment.memo || 'Payment'}</div>
                    <div class="transaction-date">${formatDate(payment.createdAt)}</div>
                </div>
                <div class="transaction-amount debit">-${formatCurrency(payment.amount)}</div>
            </div>
        `;
    }).join('');
}

function filterByCategory(category) {
    const user = getCurrentUser();
    const allBillers = getUserBillers(user.id);
    const filtered = allBillers.filter(b => b.category === category);
    
    if (filtered.length > 0) {
        showAlert(`Showing ${filtered.length} ${category} billers`, 'info');
    } else {
        showAlert(`No ${category} billers found`, 'error');
    }
}

function showAddBillerModal() {
    document.getElementById('addBillerModal').style.display = 'block';
}

function closeAddBillerModal() {
    document.getElementById('addBillerModal').style.display = 'none';
    document.getElementById('addBillerForm').reset();
}

function handleAddBiller(e) {
    e.preventDefault();
    
    const category = document.getElementById('billerCategory').value;
    const name = document.getElementById('billerName').value;
    const accountNumber = document.getElementById('accountNumber').value;
    const nickname = document.getElementById('nickname').value;
    
    const user = getCurrentUser();
    
    addBiller(user.id, {
        category,
        name,
        accountNumber,
        nickname
    });
    
    showAlert('Biller added successfully!', 'success');
    closeAddBillerModal();
    loadBillers();
}

function openPayBillModal(billerId) {
    const biller = getBillerById(billerId);
    const user = getCurrentUser();
    const accounts = getUserAccounts(user.id);
    
    document.getElementById('billerId').value = billerId;
    document.getElementById('billerInfo').innerHTML = `
        <div style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <h4>${biller.nickname || biller.name}</h4>
            <p style="margin: 5px 0; color: #666;">Account: ${biller.accountNumber}</p>
        </div>
    `;
    
    const select = document.getElementById('payFromAccount');
    select.innerHTML = '<option value="">Select account</option>';
    accounts.forEach(acc => {
        select.innerHTML += `
            <option value="${acc.id}">
                ${capitalize(acc.accountType)} - ${formatCurrency(acc.balance)}
            </option>
        `;
    });
    
    // Set default date to today
    document.getElementById('paymentDate').valueAsDate = new Date();
    
    document.getElementById('payBillModal').style.display = 'block';
}

function closePayBillModal() {
    document.getElementById('payBillModal').style.display = 'none';
    document.getElementById('payBillForm').reset();
}

function handlePayBill(e) {
    e.preventDefault();
    
    const billerId = document.getElementById('billerId').value;
    const fromAccountId = document.getElementById('payFromAccount').value;
    const amount = parseFloat(document.getElementById('billAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const memo = document.getElementById('billMemo').value;
    
    const account = getAccountById(fromAccountId);
    
    if (account.balance < amount) {
        showAlert('Insufficient funds in selected account', 'error');
        return;
    }
    
    if (!confirm(`Pay ${formatCurrency(amount)} to this biller?`)) {
        return;
    }
    
    // Update account balance
    updateAccountBalance(fromAccountId, account.balance - amount);
    
    // Record bill payment
    addBillPayment({
        billerId,
        fromAccountId,
        amount,
        paymentDate,
        memo
    });
    
    // Also create a transaction
    addTransaction({
        type: 'payment',
        fromAccountId,
        amount,
        description: `Bill payment - ${getBillerById(billerId).name}`,
        billerId
    });
    
    showAlert('Bill payment processed successfully!', 'success');
    closePayBillModal();
    loadRecentPayments();
}

window.onclick = function(event) {
    const addModal = document.getElementById('addBillerModal');
    const payModal = document.getElementById('payBillModal');
    if (event.target === addModal) {
        closeAddBillerModal();
    }
    if (event.target === payModal) {
        closePayBillModal();
    }
}
