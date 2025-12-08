/* 
 * Local Storage Management
 * Handles all data storage and retrieval
 */

// Initialize storage with demo data if empty
function initStorage() {
    if (!localStorage.getItem('users')) {
        localStorage.setItem('users', JSON.stringify([]));
    }
    if (!localStorage.getItem('accounts')) {
        localStorage.setItem('accounts', JSON.stringify([]));
    }
    if (!localStorage.getItem('transactions')) {
        localStorage.setItem('transactions', JSON.stringify([]));
    }
    if (!localStorage.getItem('cards')) {
        localStorage.setItem('cards', JSON.stringify([]));
    }
    if (!localStorage.getItem('billers')) {
        localStorage.setItem('billers', JSON.stringify([]));
    }
    if (!localStorage.getItem('billPayments')) {
        localStorage.setItem('billPayments', JSON.stringify([]));
    }
}

// USER FUNCTIONS

// Get all users
function getUsers() {
    return JSON.parse(localStorage.getItem('users')) || [];
}

// Save users
function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

// Find user by email
function findUserByEmail(email) {
    const users = getUsers();
    return users.find(user => user.email.toLowerCase() === email.toLowerCase());
}

// Add new user
function addUser(userData) {
    const users = getUsers();
    const newUser = {
        id: generateId(),
        ...userData,
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
}

// ACCOUNT FUNCTIONS

// Get all accounts
function getAccounts() {
    return JSON.parse(localStorage.getItem('accounts')) || [];
}

// Save accounts
function saveAccounts(accounts) {
    localStorage.setItem('accounts', JSON.stringify(accounts));
}

// Get user accounts
function getUserAccounts(userId) {
    const accounts = getAccounts();
    return accounts.filter(account => account.userId === userId);
}

// Add new account
function addAccount(userId, accountType, initialDeposit = 0) {
    const accounts = getAccounts();
    const newAccount = {
        id: generateId(),
        accountNumber: generateAccountNumber(),
        userId: userId,
        accountType: accountType,
        balance: initialDeposit,
        status: 'active',
        interestRate: accountType === 'savings' ? 0.5 : 0,
        createdAt: new Date().toISOString()
    };
    accounts.push(newAccount);
    saveAccounts(accounts);
    
    // If there's an initial deposit, create a transaction
    if (initialDeposit > 0) {
        addTransaction({
            type: 'deposit',
            toAccountId: newAccount.id,
            amount: initialDeposit,
            description: 'Initial deposit'
        });
    }
    
    return newAccount;
}

// Get account by ID
function getAccountById(accountId) {
    const accounts = getAccounts();
    return accounts.find(account => account.id === accountId);
}

// Update account balance
function updateAccountBalance(accountId, newBalance) {
    const accounts = getAccounts();
    const accountIndex = accounts.findIndex(acc => acc.id === accountId);
    
    if (accountIndex !== -1) {
        accounts[accountIndex].balance = newBalance;
        accounts[accountIndex].lastActivity = new Date().toISOString();
        saveAccounts(accounts);
        return true;
    }
    return false;
}

// TRANSACTION FUNCTIONS

// Get all transactions
function getTransactions() {
    return JSON.parse(localStorage.getItem('transactions')) || [];
}

// Save transactions
function saveTransactions(transactions) {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// Add new transaction
function addTransaction(transactionData) {
    const transactions = getTransactions();
    const newTransaction = {
        id: generateId(),
        transactionId: 'TXN' + Date.now().toString() + Math.floor(Math.random() * 10000),
        ...transactionData,
        status: 'completed',
        createdAt: new Date().toISOString()
    };
    transactions.push(newTransaction);
    saveTransactions(transactions);
    return newTransaction;
}

// Get user transactions
function getUserTransactions(userId) {
    const userAccounts = getUserAccounts(userId);
    const accountIds = userAccounts.map(acc => acc.id);
    const transactions = getTransactions();
    
    return transactions.filter(txn => 
        accountIds.includes(txn.fromAccountId) || 
        accountIds.includes(txn.toAccountId)
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Get account transactions
function getAccountTransactions(accountId) {
    const transactions = getTransactions();
    return transactions.filter(txn => 
        txn.fromAccountId === accountId || 
        txn.toAccountId === accountId
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// CARD FUNCTIONS

// Get all cards
function getCards() {
    return JSON.parse(localStorage.getItem('cards')) || [];
}

// Save cards
function saveCards(cards) {
    localStorage.setItem('cards', JSON.stringify(cards));
}

// Get user cards
function getUserCards(userId) {
    const cards = getCards();
    return cards.filter(card => card.userId === userId);
}

// Add new card
function addCard(userId, cardData) {
    const cards = getCards();
    
    // Generate card number
    const cardNumber = '4' + Date.now().toString().slice(-15);
    
    // Set expiry date (3 years from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 3);
    
    const newCard = {
        id: generateId(),
        userId: userId,
        cardNumber: cardNumber,
        cardType: cardData.cardType,
        linkedAccountId: cardData.linkedAccountId,
        design: cardData.design,
        status: 'active',
        expiryDate: expiryDate.toISOString(),
        cvv: Math.floor(Math.random() * 900) + 100,
        createdAt: new Date().toISOString()
    };
    
    cards.push(newCard);
    saveCards(cards);
    return newCard;
}

// BILLER FUNCTIONS

// Get all billers
function getBillers() {
    return JSON.parse(localStorage.getItem('billers')) || [];
}

// Save billers
function saveBillers(billers) {
    localStorage.setItem('billers', JSON.stringify(billers));
}

// Get user billers
function getUserBillers(userId) {
    const billers = getBillers();
    return billers.filter(biller => biller.userId === userId);
}

// Get biller by ID
function getBillerById(billerId) {
    const billers = getBillers();
    return billers.find(b => b.id === billerId);
}

// Add new biller
function addBiller(userId, billerData) {
    const billers = getBillers();
    const newBiller = {
        id: generateId(),
        userId: userId,
        ...billerData,
        createdAt: new Date().toISOString()
    };
    billers.push(newBiller);
    saveBillers(billers);
    return newBiller;
}

// BILL PAYMENT FUNCTIONS

// Get all bill payments
function getBillPayments() {
    return JSON.parse(localStorage.getItem('billPayments')) || [];
}

// Save bill payments
function saveBillPayments(payments) {
    localStorage.setItem('billPayments', JSON.stringify(payments));
}

// Get user bill payments
function getUserBillPayments(userId) {
    const payments = getBillPayments();
    const userBillers = getUserBillers(userId);
    const billerIds = userBillers.map(b => b.id);
    
    return payments.filter(p => billerIds.includes(p.billerId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Add bill payment
function addBillPayment(paymentData) {
    const payments = getBillPayments();
    const newPayment = {
        id: generateId(),
        ...paymentData,
        status: 'completed',
        createdAt: new Date().toISOString()
    };
    payments.push(newPayment);
    saveBillPayments(payments);
    return newPayment;
}

// Initialize storage on load
initStorage();
