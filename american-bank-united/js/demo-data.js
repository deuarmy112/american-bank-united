/* 
 * Demo Data - Pre-populated for testing
 * This file creates a demo account so you can test the system immediately
 */

// Create demo data when page loads
function createDemoData() {
    // Check if demo data already exists
    const users = JSON.parse(localStorage.getItem('users')) || [];
    
    // If demo user doesn't exist, create it
    const demoEmail = 'demo@americanbank.com';
    const existingDemo = users.find(u => u.email === demoEmail);
    
    if (!existingDemo) {
        // Create demo user
        const demoUser = {
            id: 'demo-user-001',
            firstName: 'John',
            lastName: 'Doe',
            email: demoEmail,
            password: 'demo123',
            phone: '(555) 123-4567',
            dateOfBirth: '1990-01-15',
            role: 'customer',
            status: 'active',
            createdAt: new Date('2024-01-01').toISOString()
        };
        
        users.push(demoUser);
        localStorage.setItem('users', JSON.stringify(users));
        
        // Create demo accounts
        const accounts = JSON.parse(localStorage.getItem('accounts')) || [];
        
        const checkingAccount = {
            id: 'acc-checking-001',
            accountNumber: 'ABU1704067200001234',
            userId: demoUser.id,
            accountType: 'checking',
            balance: 5420.50,
            status: 'active',
            interestRate: 0,
            createdAt: new Date('2024-01-01').toISOString()
        };
        
        const savingsAccount = {
            id: 'acc-savings-001',
            accountNumber: 'ABU1704067200005678',
            userId: demoUser.id,
            accountType: 'savings',
            balance: 12850.75,
            status: 'active',
            interestRate: 0.5,
            createdAt: new Date('2024-02-15').toISOString()
        };
        
        const businessAccount = {
            id: 'acc-business-001',
            accountNumber: 'ABU1704067200009012',
            userId: demoUser.id,
            accountType: 'business',
            balance: 28500.00,
            status: 'active',
            interestRate: 0,
            createdAt: new Date('2024-03-01').toISOString()
        };
        
        accounts.push(checkingAccount, savingsAccount, businessAccount);
        localStorage.setItem('accounts', JSON.stringify(accounts));
        
        // Create demo transactions
        const transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        
        const demoTransactions = [
            {
                id: 'txn-001',
                transactionId: 'TXN170406720000001',
                type: 'deposit',
                toAccountId: checkingAccount.id,
                amount: 2500.00,
                description: 'Salary deposit',
                status: 'completed',
                createdAt: new Date('2024-11-01T10:30:00').toISOString()
            },
            {
                id: 'txn-002',
                transactionId: 'TXN170406720000002',
                type: 'transfer',
                fromAccountId: checkingAccount.id,
                toAccountId: savingsAccount.id,
                amount: 1000.00,
                description: 'Monthly savings',
                status: 'completed',
                createdAt: new Date('2024-11-05T14:20:00').toISOString()
            },
            {
                id: 'txn-003',
                transactionId: 'TXN170406720000003',
                type: 'withdrawal',
                fromAccountId: checkingAccount.id,
                amount: 150.00,
                description: 'ATM withdrawal',
                status: 'completed',
                createdAt: new Date('2024-11-10T09:15:00').toISOString()
            },
            {
                id: 'txn-004',
                transactionId: 'TXN170406720000004',
                type: 'deposit',
                toAccountId: businessAccount.id,
                amount: 5000.00,
                description: 'Client payment',
                status: 'completed',
                createdAt: new Date('2024-11-15T16:45:00').toISOString()
            },
            {
                id: 'txn-005',
                transactionId: 'TXN170406720000005',
                type: 'transfer',
                fromAccountId: businessAccount.id,
                toAccountId: checkingAccount.id,
                amount: 2000.00,
                description: 'Business to personal',
                status: 'completed',
                createdAt: new Date('2024-11-20T11:30:00').toISOString()
            },
            {
                id: 'txn-006',
                transactionId: 'TXN170406720000006',
                type: 'deposit',
                toAccountId: savingsAccount.id,
                amount: 3000.00,
                description: 'Bonus deposit',
                status: 'completed',
                createdAt: new Date('2024-11-25T13:00:00').toISOString()
            },
            {
                id: 'txn-007',
                transactionId: 'TXN170406720000007',
                type: 'withdrawal',
                fromAccountId: checkingAccount.id,
                amount: 75.50,
                description: 'Grocery shopping',
                status: 'completed',
                createdAt: new Date('2024-12-01T08:20:00').toISOString()
            },
            {
                id: 'txn-008',
                transactionId: 'TXN170406720000008',
                type: 'transfer',
                fromAccountId: checkingAccount.id,
                toAccountId: savingsAccount.id,
                amount: 500.00,
                description: 'Emergency fund',
                status: 'completed',
                createdAt: new Date('2024-12-05T10:00:00').toISOString()
            }
        ];
        
        transactions.push(...demoTransactions);
        localStorage.setItem('transactions', JSON.stringify(transactions));
        
        // Create demo cards
        const cards = JSON.parse(localStorage.getItem('cards')) || [];
        
        const demoCards = [
            {
                id: 'card-001',
                userId: demoUser.id,
                cardNumber: '4532123456789012',
                cardType: 'debit',
                linkedAccountId: checkingAccount.id,
                design: 'classic',
                status: 'active',
                expiryDate: new Date('2028-12-31').toISOString(),
                cvv: 123,
                createdAt: new Date('2024-01-15').toISOString()
            },
            {
                id: 'card-002',
                userId: demoUser.id,
                cardNumber: '5425233456789123',
                cardType: 'credit',
                linkedAccountId: checkingAccount.id,
                design: 'gold',
                status: 'active',
                expiryDate: new Date('2027-06-30').toISOString(),
                cvv: 456,
                createdAt: new Date('2024-03-20').toISOString()
            }
        ];
        
        cards.push(...demoCards);
        localStorage.setItem('cards', JSON.stringify(cards));
        
        // Create demo billers
        const billers = JSON.parse(localStorage.getItem('billers')) || [];
        
        const demoBillers = [
            {
                id: 'biller-001',
                userId: demoUser.id,
                category: 'utilities',
                name: 'City Electric Company',
                accountNumber: 'ELEC-123456',
                nickname: 'Home Electric',
                createdAt: new Date('2024-02-01').toISOString()
            },
            {
                id: 'biller-002',
                userId: demoUser.id,
                category: 'internet',
                name: 'FastNet Internet Services',
                accountNumber: 'NET-789012',
                nickname: 'Home Internet',
                createdAt: new Date('2024-02-05').toISOString()
            },
            {
                id: 'biller-003',
                userId: demoUser.id,
                category: 'phone',
                name: 'Mobile Plus',
                accountNumber: 'MOB-345678',
                nickname: 'Cell Phone',
                createdAt: new Date('2024-02-10').toISOString()
            },
            {
                id: 'biller-004',
                userId: demoUser.id,
                category: 'insurance',
                name: 'SafeGuard Insurance',
                accountNumber: 'INS-901234',
                nickname: 'Car Insurance',
                createdAt: new Date('2024-02-15').toISOString()
            }
        ];
        
        billers.push(...demoBillers);
        localStorage.setItem('billers', JSON.stringify(billers));
        
        // Create demo bill payments
        const billPayments = JSON.parse(localStorage.getItem('billPayments')) || [];
        
        const demoBillPayments = [
            {
                id: 'payment-001',
                billerId: 'biller-001',
                fromAccountId: checkingAccount.id,
                amount: 125.50,
                paymentDate: '2024-11-05',
                memo: 'Monthly electric bill',
                status: 'completed',
                createdAt: new Date('2024-11-05T10:00:00').toISOString()
            },
            {
                id: 'payment-002',
                billerId: 'biller-002',
                fromAccountId: checkingAccount.id,
                amount: 79.99,
                paymentDate: '2024-11-10',
                memo: 'Internet service',
                status: 'completed',
                createdAt: new Date('2024-11-10T14:30:00').toISOString()
            },
            {
                id: 'payment-003',
                billerId: 'biller-003',
                fromAccountId: checkingAccount.id,
                amount: 55.00,
                paymentDate: '2024-11-15',
                memo: 'Phone bill',
                status: 'completed',
                createdAt: new Date('2024-11-15T09:45:00').toISOString()
            }
        ];
        
        billPayments.push(...demoBillPayments);
        localStorage.setItem('billPayments', JSON.stringify(billPayments));
        
        console.log('✅ Demo data created successfully!');
        console.log('📧 Email: demo@americanbank.com');
        console.log('🔑 Password: demo123');
    }
}

// Run when script loads
createDemoData();
