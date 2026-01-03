/* 
 * Bills Page Script - API Version
 */

document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    await displayUserName();
    await loadBillers();
    await loadRecentPayments();
});

async function loadBillers() {
    try {
        const billers = await billsAPI.getBillers();
        displayBillers(billers);
    } catch (error) {
        console.error('Failed to load billers:', error);
        showAlert('Failed to load billers', 'error');
    }
}

async function loadRecentPayments() {
    try {
        const payments = await billsAPI.getPayments();
        displayRecentPayments(payments.slice(0, 5));
    } catch (error) {
        console.error('Failed to load payments:', error);
    }
}

function displayBillers(billers) {
    const billersList = document.getElementById('billersList');
    
    if (billers.length === 0) {
        billersList.innerHTML = '<p class="no-data">No saved billers. Add one to get started.</p>';
        return;
    }
    
    billersList.innerHTML = '';
    
    billers.forEach(biller => {
        const billerCard = document.createElement('div');
        billerCard.className = 'biller-card';
        
        let icon;
        switch (biller.category) {
            case 'utilities': icon = 'fa-bolt'; break;
            case 'internet': icon = 'fa-wifi'; break;
            case 'phone': icon = 'fa-mobile-alt'; break;
            case 'insurance': icon = 'fa-shield-alt'; break;
            case 'credit-card': icon = 'fa-credit-card'; break;
            case 'loan': icon = 'fa-university'; break;
            default: icon = 'fa-file-invoice-dollar';
        }
        
        billerCard.innerHTML = `
            <div class="biller-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="biller-info">
                <h3>${biller.nickname || biller.name}</h3>
                <p>${biller.name}</p>
                <p class="biller-category">${biller.category}</p>
            </div>
            <button class="btn-pay" onclick="openPayBillModal('${biller.id}', '${biller.nickname || biller.name}')">
                <i class="fas fa-paper-plane"></i> Pay
            </button>
        `;
        
        billersList.appendChild(billerCard);
    });
}

function displayRecentPayments(payments) {
    const paymentsList = document.getElementById('recentPaymentsList');
    
    if (payments.length === 0) {
        paymentsList.innerHTML = '<p class="no-data">No recent payments</p>';
        return;
    }
    
    paymentsList.innerHTML = '';
    
    payments.forEach(payment => {
        const paymentRow = document.createElement('div');
        paymentRow.className = 'payment-item';
        paymentRow.innerHTML = `
            <div>
                <p class="payment-name">${payment.biller_name}</p>
                <p class="payment-date">${formatDate(payment.created_at)}</p>
            </div>
            <p class="payment-amount">${formatCurrency(payment.amount)}</p>
        `;
        paymentsList.appendChild(paymentRow);
    });
}

// Modal functions
function showAddBillerModal() {
    document.getElementById('addBillerModal').style.display = 'flex';
}

function closeAddBillerModal() {
    document.getElementById('addBillerModal').style.display = 'none';
}

async function openPayBillModal(billerId, billerName) {
    document.getElementById('payBillModal').style.display = 'flex';
    document.getElementById('selectedBillerName').textContent = billerName;
    document.getElementById('hiddenBillerId').value = billerId;
    
    // Load accounts for payment
    try {
        const accounts = await accountsAPI.getAll();
        const select = document.getElementById('paymentAccount');
        select.innerHTML = '<option value="">Select Account</option>';
        
        accounts.forEach(account => {
            const option = new Option(
                `${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} - ${account.account_number} (${formatCurrency(account.balance)})`,
                account.id
            );
            select.add(option);
        });
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
}

function closePayBillModal() {
    document.getElementById('payBillModal').style.display = 'none';
}

// Handle add biller form
document.getElementById('addBillerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const category = document.getElementById('billerCategory').value;
    const name = document.getElementById('billerName').value.trim();
    const accountNumber = document.getElementById('billerAccountNumber').value.trim();
    const nickname = document.getElementById('billerNickname').value.trim();
    
    if (!category || !name || !accountNumber) {
        showAlert('Please fill in required fields', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        await billsAPI.addBiller({ category, name, accountNumber, nickname });
        
        showAlert('Biller added successfully!', 'success');
        closeAddBillerModal();
        
        await loadBillers();
        
        e.target.reset();
        submitBtn.textContent = 'Add Biller';
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Failed to add biller:', error);
        showAlert(error.message || 'Failed to add biller', 'error');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Add Biller';
        submitBtn.disabled = false;
    }
});

// Handle pay bill form
document.getElementById('payBillForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const billerId = document.getElementById('hiddenBillerId').value;
    const fromAccountId = document.getElementById('paymentAccount').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const memo = document.getElementById('paymentMemo').value.trim();
    
    if (!billerId || !fromAccountId || !amount || !paymentDate) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    if (amount <= 0) {
        showAlert('Please enter a valid amount', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;
        
        await billsAPI.payBill({
            billerId,
            fromAccountId,
            amount,
            paymentDate,
            memo
        });
        
        showAlert('Payment completed successfully!', 'success');
        closePayBillModal();
        
        await loadRecentPayments();
        
        e.target.reset();
        submitBtn.textContent = 'Pay Now';
        submitBtn.disabled = false;
        
    } catch (error) {
        console.error('Payment failed:', error);
        showAlert(error.message || 'Payment failed', 'error');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Pay Now';
        submitBtn.disabled = false;
    }
});
