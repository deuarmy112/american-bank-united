/* 
 * Accounts Page Script
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!requireAuth()) return;
    
    // Display user info
    displayUserName();
    
    // Load accounts
    loadAccounts();
    
    // Handle account type selection
    const accountTypeSelect = document.getElementById('accountType');
    accountTypeSelect.addEventListener('change', showAccountBenefits);
    
    // Handle create account form submission
    const createAccountForm = document.getElementById('createAccountForm');
    createAccountForm.addEventListener('submit', handleCreateAccount);
});

function loadAccounts() {
    const user = getCurrentUser();
    const accounts = getUserAccounts(user.id);
    const accountsList = document.getElementById('accountsList');
    
    if (accounts.length === 0) {
        accountsList.innerHTML = `
            <div class="card text-center">
                <h3>No accounts yet</h3>
                <p>Click the "Create New Account" button to open your first account</p>
            </div>
        `;
        return;
    }
    
    accountsList.innerHTML = accounts.map(account => {
        const transactions = getAccountTransactions(account.id);
        
        return `
            <div class="account-card">
                <div class="account-header">
                    <h3>${capitalize(account.accountType)} Account</h3>
                    <span class="account-status">${account.status}</span>
                </div>
                <div class="account-number">Account: ${account.accountNumber}</div>
                <div class="account-balance">${formatCurrency(account.balance)}</div>
                ${account.interestRate > 0 ? `<div class="account-info">Interest Rate: ${account.interestRate}%</div>` : ''}
                <div class="account-info">Transactions: ${transactions.length}</div>
                <div class="account-info">Opened: ${formatDate(account.createdAt)}</div>
            </div>
        `;
    }).join('');
}

function showCreateAccountModal() {
    document.getElementById('createAccountModal').style.display = 'block';
}

function closeCreateAccountModal() {
    document.getElementById('createAccountModal').style.display = 'none';
    document.getElementById('createAccountForm').reset();
    document.getElementById('accountBenefits').innerHTML = '<li>Select an account type to see benefits</li>';
}

function showAccountBenefits() {
    const accountType = document.getElementById('accountType').value;
    const benefitsList = document.getElementById('accountBenefits');
    
    const benefits = {
        checking: [
            'No monthly maintenance fees',
            'Unlimited transactions',
            'Debit card access',
            'Online bill pay',
            'Mobile banking app'
        ],
        savings: [
            '0.5% annual interest rate',
            'No minimum balance required',
            'Automatic savings plans',
            'FDIC insured',
            'Easy transfers to checking'
        ],
        business: [
            'Business tools and resources',
            'Higher transaction limits',
            'Multiple user access',
            'Accounting software integration',
            'Dedicated support'
        ]
    };
    
    if (accountType && benefits[accountType]) {
        benefitsList.innerHTML = benefits[accountType]
            .map(benefit => `<li>${benefit}</li>`)
            .join('');
    } else {
        benefitsList.innerHTML = '<li>Select an account type to see benefits</li>';
    }
}

function handleCreateAccount(e) {
    e.preventDefault();
    
    const accountType = document.getElementById('accountType').value;
    const initialDeposit = parseFloat(document.getElementById('initialDeposit').value) || 0;
    
    // Validate account type
    if (!accountType) {
        showAlert('Please select an account type', 'error');
        return;
    }
    
    // Validate initial deposit
    if (initialDeposit < 0) {
        showAlert('Initial deposit cannot be negative', 'error');
        return;
    }
    
    // Get current user
    const user = getCurrentUser();
    
    // Check if user already has this type of account
    const existingAccounts = getUserAccounts(user.id);
    const hasAccountType = existingAccounts.some(acc => acc.accountType === accountType);
    
    if (hasAccountType) {
        if (!confirm(`You already have a ${accountType} account. Do you want to create another one?`)) {
            return;
        }
    }
    
    // Create the account
    const newAccount = addAccount(user.id, accountType, initialDeposit);
    
    showAlert(`${capitalize(accountType)} account created successfully!`, 'success');
    
    // Close modal and reload accounts
    closeCreateAccountModal();
    loadAccounts();
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('createAccountModal');
    if (event.target === modal) {
        closeCreateAccountModal();
    }
}
