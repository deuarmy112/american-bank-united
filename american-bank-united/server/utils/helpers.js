const crypto = require('crypto');

// Generate unique ID
function generateId() {
    return crypto.randomBytes(8).toString('hex');
}

// Generate account number
function generateAccountNumber() {
    const randomNum = Math.floor(Math.random() * 9000000000) + 1000000000;
    return randomNum.toString();
}

// Generate card number
function generateCardNumber() {
    let cardNumber = '4'; // Visa starts with 4
    for (let i = 0; i < 15; i++) {
        cardNumber += Math.floor(Math.random() * 10);
    }
    return cardNumber;
}

// Generate CVV
function generateCVV() {
    return Math.floor(Math.random() * 900 + 100).toString();
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

module.exports = {
    generateId,
    generateAccountNumber,
    generateCardNumber,
    generateCVV,
    formatCurrency
};
