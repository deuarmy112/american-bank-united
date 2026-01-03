# American Bank United - Banking System
### A Beginner-Friendly HTML, CSS & JavaScript Project

---

## 📚 Table of Contents
1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [How to Run the Project](#how-to-run-the-project)
4. [Understanding the Code](#understanding-the-code)
5. [Features Explained](#features-explained)
6. [Learning Path](#learning-path)
7. [How to Customize](#how-to-customize)

---

## 🎯 Project Overview

This is a **complete banking system** built using only HTML, CSS, and JavaScript. It's perfect for beginners because:
- ✅ No backend server required
- ✅ No database setup needed
- ✅ Uses browser's localStorage for data
- ✅ Clean, commented code
- ✅ Modern, professional design

### What Can It Do?
- **User Registration & Login** - Create accounts and login securely
- **Multiple Bank Accounts** - Checking, Savings, and Business accounts
- **Transfers** - Move money between your accounts
- **Transaction History** - View all your banking activities
- **Dashboard** - See your financial overview at a glance

---

## 📁 File Structure

```
american-bank-united/
│
├── index.html              # Login page (starting point)
├── register.html           # Registration page
├── dashboard.html          # Main dashboard after login
├── accounts.html           # View and create accounts
├── transfer.html           # Transfer money between accounts
├── transactions.html       # View transaction history
│
├── css/
│   ├── style.css          # Main styles (colors, buttons, forms)
│   ├── auth.css           # Login & register page styles
│   └── dashboard.css      # Dashboard, accounts, transactions styles
│
├── js/
│   ├── utils.js           # Helper functions (format money, dates, etc.)
│   ├── auth.js            # Authentication logic (login/logout)
│   ├── storage.js         # Data management (localStorage operations)
│   ├── login.js           # Login page functionality
│   ├── register.js        # Registration page functionality
│   ├── dashboard.js       # Dashboard page functionality
│   ├── accounts.js        # Accounts page functionality
│   ├── transfer.js        # Transfer page functionality
│   └── transactions.js    # Transactions page functionality
│
└── README_GUIDE.md        # This file!
```

---

## 🚀 How to Run the Project

### Method 1: Double-Click (Easiest)
1. Navigate to your project folder
2. Double-click on `index.html`
3. It will open in your default browser
4. That's it! 🎉

### Method 2: Using VS Code (Recommended for Development)
1. Open the project folder in VS Code
2. Install the "Live Server" extension
3. Right-click on `index.html`
4. Select "Open with Live Server"
5. The site will open automatically

### First Time Use:
Since there's no data yet, you need to:
1. Click "Register here" on the login page
2. Fill in the registration form
3. Create your account
4. You'll be automatically logged in
5. Start exploring!

---

## 💡 Understanding the Code

### 1. **HTML Files** (The Structure)
HTML files define the structure and content of each page.

**Example from index.html:**
```html
<input type="email" id="email" name="email" required>
```
- `type="email"` - Makes it an email input
- `id="email"` - Used by JavaScript to get the value
- `required` - Browser won't submit without it

**Key Concepts:**
- `<div>` - Container for grouping elements
- `<form>` - Container for input fields
- `<button>` - Clickable button
- `<script src="...">` - Loads JavaScript files

### 2. **CSS Files** (The Style)
CSS makes everything look beautiful.

**Example from style.css:**
```css
.btn-primary {
    background: linear-gradient(135deg, #003087, #0070ba);
    color: white;
}
```
- `.btn-primary` - Selects elements with class="btn-primary"
- `background` - Sets the button color (gradient)
- `color` - Sets the text color

**Key Concepts:**
- `:root` - CSS variables (like colors you can reuse)
- `.class` - Targets elements with that class
- `#id` - Targets element with that ID
- `@media` - Responsive design for mobile

### 3. **JavaScript Files** (The Functionality)

#### **utils.js** - Helper Functions
```javascript
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
```
**What it does:** Converts `1000` to `$1,000.00`

#### **storage.js** - Data Management
This is the "database" of our app. It uses `localStorage`.

```javascript
function getUserAccounts(userId) {
    const accounts = getAccounts();
    return accounts.filter(account => account.userId === userId);
}
```
**What it does:** Gets all accounts belonging to a specific user

**localStorage explained:**
- `localStorage.setItem('key', 'value')` - Save data
- `localStorage.getItem('key')` - Get data
- Data persists even after closing browser
- Stores only strings (we use JSON to store objects)

#### **auth.js** - Authentication
```javascript
function isLoggedIn() {
    return localStorage.getItem('currentUser') !== null;
}
```
**What it does:** Checks if a user is logged in by looking for 'currentUser' in localStorage

#### **login.js** - Login Logic
```javascript
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();  // Prevents page reload
    // ... validation logic
    // ... check password
    // ... save user and redirect
});
```
**What it does:** Handles the login form submission

---

## 🔥 Features Explained

### 1. User Registration
**File:** `register.js`

**Process:**
1. User fills form
2. JavaScript validates:
   - All fields filled?
   - Valid email format?
   - Age 18 or older?
   - Passwords match?
   - Email not already used?
3. Creates user object
4. Saves to localStorage
5. Auto-creates first checking account
6. Redirects to dashboard

### 2. User Login
**File:** `login.js`

**Process:**
1. User enters email & password
2. Find user by email
3. Check if password matches
4. Save user to 'currentUser' in localStorage
5. Redirect to dashboard

### 3. Dashboard
**File:** `dashboard.js`

**What it shows:**
- Total balance across all accounts
- Number of accounts
- Transaction count
- Monthly activity
- Account cards
- Recent transactions

**How it works:**
1. Gets current user
2. Gets all their accounts
3. Calculates totals
4. Displays everything

### 4. Create Account
**File:** `accounts.js`

**Process:**
1. User selects account type
2. Optionally adds initial deposit
3. System generates:
   - Unique account ID
   - Account number (ABU + timestamp)
   - Sets interest rate (0.5% for savings)
4. Saves to localStorage
5. If initial deposit > 0, creates deposit transaction

### 5. Transfer Money
**File:** `transfer.js`

**Process:**
1. User selects source account
2. User selects destination account
3. Enters amount
4. System validates:
   - Different accounts?
   - Sufficient balance?
5. Updates both account balances
6. Creates transaction record
7. Success message

### 6. View Transactions
**File:** `transactions.js`

**Features:**
- Shows all transactions
- Filter by account
- Filter by type
- Search by description
- Shows income/expense summary

---

## 📖 Learning Path

### Level 1: Understanding Basics
1. **Open `index.html` in VS Code**
   - Read through the HTML structure
   - Find the form, inputs, and buttons
   - See how JavaScript files are linked at the bottom

2. **Open `css/style.css`**
   - Look at CSS variables in `:root`
   - Find `.btn-primary` and see how buttons are styled
   - Change a color and see what happens!

3. **Open `js/utils.js`**
   - Read the `formatCurrency` function
   - Try using it in browser console: `formatCurrency(1234.56)`

### Level 2: Understanding Flow
1. **Follow a Login:**
   - Start in `index.html` - The form
   - Go to `js/login.js` - The form submission
   - See how it uses `storage.js` functions
   - See how it redirects to dashboard

2. **Follow a Transfer:**
   - Open `transfer.html` - The form
   - Go to `js/transfer.js` - The logic
   - See how it validates
   - See how it updates balances

### Level 3: Making Changes
1. **Change Colors:**
   - Edit CSS variables in `css/style.css`
   - Change `--primary-color` to your favorite color

2. **Add a Feature:**
   - Try adding a "Withdraw" button on accounts page
   - It should decrease balance and create a transaction

3. **Modify Validation:**
   - Change minimum age from 18 to 21 in `register.js`
   - Add requirement for password to have uppercase letter

---

## 🎨 How to Customize

### Change Colors
Edit `css/style.css`:
```css
:root {
    --primary-color: #003087;     /* Change this */
    --secondary-color: #0070ba;   /* And this */
}
```

### Change Bank Name
1. Update in all HTML files: Search and replace "American Bank United"
2. Update account number prefix in `storage.js`: Change 'ABU' to your initials

### Add a New Account Type
1. **In `accounts.html`** - Add option:
```html
<option value="investment">Investment Account</option>
```

2. **In `accounts.js`** - Add benefits:
```javascript
investment: [
    'Higher interest rates',
    'Investment options',
    'Professional advice'
]
```

### Add Deposit/Withdrawal Feature
1. Create form in `accounts.html`
2. Add function in `accounts.js`:
```javascript
function depositMoney(accountId, amount) {
    const account = getAccountById(accountId);
    const newBalance = account.balance + amount;
    updateAccountBalance(accountId, newBalance);
    addTransaction({
        type: 'deposit',
        toAccountId: accountId,
        amount: amount,
        description: 'Deposit'
    });
}
```

---

## 🐛 Common Issues & Solutions

### Issue: Data disappears when I refresh
**Solution:** Check browser console for errors. localStorage might be disabled.

### Issue: Login doesn't work
**Solution:** Make sure you registered first. Check console for error messages.

### Issue: Styles not loading
**Solution:** Check that CSS files are in the `css/` folder with correct names.

### Issue: JavaScript errors
**Solution:** Open browser console (F12) to see specific error messages.

---

## 🎓 Key Programming Concepts You'll Learn

1. **HTML Structure** - Forms, inputs, semantic tags
2. **CSS Styling** - Flexbox, Grid, animations, responsive design
3. **JavaScript Basics** - Variables, functions, arrays, objects
4. **DOM Manipulation** - Selecting elements, changing content
5. **Event Handling** - Forms, clicks, changes
6. **Data Storage** - localStorage, JSON
7. **Data Structures** - Arrays of objects, filtering, sorting
8. **Validation** - Form validation, business logic
9. **User Experience** - Loading states, alerts, confirmations

---

## 📝 Exercises to Practice

### Easy:
1. Add a "Delete Account" button
2. Change the color scheme to blue/green
3. Add more account benefits to the list
4. Add a footer with copyright info

### Medium:
1. Add a "Deposit Money" feature
2. Add a "Withdraw Money" feature
3. Add search functionality to accounts
4. Show last login date on dashboard

### Hard:
1. Add support for multiple currencies
2. Add transaction categories (rent, food, etc.)
3. Add monthly spending chart using Canvas API
4. Add account statements (export to PDF)

---

## 🌟 Next Steps

After mastering this project:
1. **Learn Backend Development** - Node.js, Express
2. **Learn Databases** - MongoDB, MySQL
3. **Learn React** - Modern frontend framework
4. **Learn APIs** - Connect frontend to backend
5. **Learn Security** - Proper authentication, encryption

---

## 💬 Understanding Key Code Snippets

### How Registration Works:
```javascript
// 1. Get form data
const firstName = document.getElementById('firstName').value;

// 2. Validate
if (!firstName) {
    showAlert('Please fill in all fields', 'error');
    return;
}

// 3. Check if user exists
if (findUserByEmail(email)) {
    showAlert('User already exists', 'error');
    return;
}

// 4. Create user
const newUser = addUser({ firstName, lastName, email, ... });

// 5. Login and redirect
localStorage.setItem('currentUser', JSON.stringify(newUser));
window.location.href = 'dashboard.html';
```

### How Data is Stored:
```javascript
// Store array of users
const users = [
    { id: '123', firstName: 'John', email: 'john@example.com' },
    { id: '456', firstName: 'Jane', email: 'jane@example.com' }
];
localStorage.setItem('users', JSON.stringify(users));

// Retrieve users
const storedUsers = JSON.parse(localStorage.getItem('users'));
```

### How Transfers Work:
```javascript
// 1. Get accounts
const fromAccount = getAccountById(fromAccountId);
const toAccount = getAccountById(toAccountId);

// 2. Check balance
if (fromAccount.balance < amount) {
    showAlert('Insufficient funds', 'error');
    return;
}

// 3. Update balances
updateAccountBalance(fromAccountId, fromAccount.balance - amount);
updateAccountBalance(toAccountId, toAccount.balance + amount);

// 4. Record transaction
addTransaction({
    type: 'transfer',
    fromAccountId,
    toAccountId,
    amount,
    description
});
```

---

## 🎉 Congratulations!

You now have a fully functional banking system! Take your time to explore each file, understand how things work, and experiment with changes.

**Remember:** The best way to learn programming is by:
1. Reading code
2. Understanding what it does
3. Making small changes
4. Breaking things (and fixing them!)
5. Building new features

Happy coding! 🚀
