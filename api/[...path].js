const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { admin, getDb, getBucket } = require('./firebase');

const GUEST_ID = 'guest-user';
const JWT_SECRET = () => process.env.JWT_SECRET || process.env.FIREBASE_PROJECT_ID || 'development-only-secret';

function now() {
    return new Date().toISOString();
}

function clean(data) {
    return JSON.parse(JSON.stringify(data, (_, value) => {
        if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
        return value;
    }));
}

function makeToken(user) {
    return jwt.sign({ userId: user.id, email: user.email, role: user.role || 'customer' }, JWT_SECRET(), { expiresIn: '7d' });
}

function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

async function authenticate(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || token === 'guest-token') {
        return { userId: GUEST_ID, email: 'guest@americanbankunited.local', role: 'customer' };
    }
    try {
        return jwt.verify(token, JWT_SECRET());
    } catch (error) {
        const err = new Error('Invalid or expired token');
        err.status = 401;
        throw err;
    }
}

function requireAdmin(user) {
    if (!['admin', 'super_admin'].includes(user.role)) {
        const error = new Error('Access denied. Admin privileges required.');
        error.status = 403;
        throw error;
    }
}

async function getDoc(collection, id) {
    const snapshot = await getDb().collection(collection).doc(id).get();
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function listDocs(collection, field, value, orderField = 'created_at', limit = 200) {
    const snapshot = await getDb().collection(collection).where(field, '==', value).limit(limit).get();
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((left, right) => String(right[orderField] || '').localeCompare(String(left[orderField] || '')));
}

async function save(collection, data, id = randomUUID()) {
    const record = { ...data, id, created_at: data.created_at || now(), updated_at: now() };
    await getDb().collection(collection).doc(id).set(record, { merge: true });
    return record;
}

async function ensureGuest() {
    const ref = getDb().collection('users').doc(GUEST_ID);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
        await ref.set({ id: GUEST_ID, email: 'guest@americanbankunited.local', first_name: 'Guest', last_name: 'User', role: 'customer', status: 'active', created_at: now() });
    }
    const accounts = await listDocs('accounts', 'user_id', GUEST_ID, null, 10);
    if (!accounts.length) {
        await save('accounts', { user_id: GUEST_ID, account_number: '1000000001', account_type: 'checking', balance: 10000, status: 'active', approval_status: 'approved' }, 'guest-checking');
    }
}

async function userProfile(userId) {
    if (userId === GUEST_ID) return { id: GUEST_ID, email: 'guest@americanbankunited.local', first_name: 'Guest', last_name: 'User', role: 'customer', status: 'active' };
    return getDoc('users', userId);
}

async function authRegister(body) {
    const { email, password, firstName, lastName, phone, dateOfBirth } = body;
    if (!email || !password || !firstName || !lastName) return { status: 400, body: { error: 'Required fields are missing' } };
    const existing = await getDb().collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (!existing.empty) return { status: 400, body: { error: 'Email already registered' } };
    const id = randomUUID();
    const user = { id, email: email.toLowerCase(), first_name: firstName, last_name: lastName, phone: phone || null, date_of_birth: dateOfBirth || null, password_hash: await bcrypt.hash(password, 10), role: 'customer', status: 'active', created_at: now() };
    await getDb().collection('users').doc(id).set(user);
    return { status: 201, body: { message: 'User registered successfully', token: makeToken(user), user: { id, email: user.email, firstName, lastName, role: 'customer' } } };
}

async function authLogin(body) {
    const { email, password } = body;
    const snapshot = await getDb().collection('users').where('email', '==', String(email || '').toLowerCase()).limit(1).get();
    if (snapshot.empty) return { status: 401, body: { error: 'Invalid email or password' } };
    const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    if (user.status && user.status !== 'active') return { status: 403, body: { error: 'Account is inactive or suspended' } };
    if (!(await bcrypt.compare(password || '', user.password_hash || ''))) return { status: 401, body: { error: 'Invalid email or password' } };
    await getDb().collection('users').doc(user.id).set({ last_login: now() }, { merge: true });
    return { body: { message: 'Login successful', token: makeToken(user), user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role || 'customer' } } };
}

async function accountRoutes(method, parts, user, body) {
    if (method === 'GET' && parts.length === 0) return { body: clean(await listDocs('accounts', 'user_id', user.userId)) };
    if (method === 'GET' && parts.length === 1) {
        const account = await getDoc('accounts', parts[0]);
        return account && account.user_id === user.userId ? { body: clean(account) } : { status: 404, body: { error: 'Account not found' } };
    }
    if (method === 'GET' && parts[1] === 'transactions') {
        const account = await getDoc('accounts', parts[0]);
        if (!account || account.user_id !== user.userId) return { status: 404, body: { error: 'Account not found' } };
        return { body: clean(await listDocs('transactions', 'account_id', parts[0])) };
    }
    if (method === 'POST' && parts.length === 0) {
        if (!['checking', 'savings', 'business'].includes(body.accountType)) return { status: 400, body: { error: 'Invalid account type' } };
        const account = await save('accounts', { user_id: user.userId, account_number: String(Math.floor(1000000000 + Math.random() * 8999999999)), account_type: body.accountType, balance: 0, status: 'inactive', approval_status: 'pending' });
        return { status: 201, body: { message: 'Account created successfully. Pending admin approval.', account: clean(account) } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

async function transactionRoutes(method, parts, user, body) {
    if (method === 'GET' && parts.length === 0) {
        const accounts = await listDocs('accounts', 'user_id', user.userId, null, 1000);
        const ids = new Set(accounts.map(account => account.id));
        const all = [];
        for (const account of ids) all.push(...await listDocs('transactions', 'account_id', account, null, 200));
        return { body: clean(all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 200)) };
    }
    if (method !== 'POST' || parts[0] !== 'transfer') return { status: 404, body: { error: 'Route not found' } };
    const amount = Number(body.amount);
    if (!body.fromAccountId || !body.toAccountId || amount <= 0) return { status: 400, body: { error: 'Transfer details are invalid' } };
    if (body.fromAccountId === body.toAccountId) return { status: 400, body: { error: 'Cannot transfer to the same account' } };
    const db = getDb();
    const result = await db.runTransaction(async transaction => {
        const fromRef = db.collection('accounts').doc(body.fromAccountId);
        const toRef = db.collection('accounts').doc(body.toAccountId);
        const [fromSnap, toSnap] = await Promise.all([transaction.get(fromRef), transaction.get(toRef)]);
        if (!fromSnap.exists || fromSnap.data().user_id !== user.userId || fromSnap.data().status !== 'active') throw new Error('Source account not found');
        if (!toSnap.exists || toSnap.data().status !== 'active') throw new Error('Destination account not found');
        const from = { id: fromSnap.id, ...fromSnap.data() };
        const to = { id: toSnap.id, ...toSnap.data() };
        if (Number(from.balance) < amount) throw new Error('Insufficient funds');
        const fromBalance = Number((Number(from.balance) - amount).toFixed(2));
        const toBalance = Number((Number(to.balance) + amount).toFixed(2));
        transaction.update(fromRef, { balance: fromBalance, updated_at: now() });
        transaction.update(toRef, { balance: toBalance, updated_at: now() });
        const withdrawalId = randomUUID();
        const depositId = randomUUID();
        transaction.set(db.collection('transactions').doc(withdrawalId), { id: withdrawalId, account_id: from.id, type: 'transfer', amount: -amount, description: body.description || 'Transfer out', related_account_id: to.id, balance_after: fromBalance, approval_status: 'approved', created_at: now() });
        transaction.set(db.collection('transactions').doc(depositId), { id: depositId, account_id: to.id, type: 'deposit', amount, description: body.description || 'Transfer in', related_account_id: from.id, balance_after: toBalance, approval_status: 'approved', created_at: now() });
        return { withdrawalId, depositId, fromBalance };
    });
    return { body: { message: 'Transfer completed successfully', status: 'approved', withdrawalId: result.withdrawalId, depositId: result.depositId, newBalance: result.fromBalance } };
}

async function cardRoutes(method, parts, user, body) {
    if (method === 'GET') return { body: clean(await listDocs('cards', 'user_id', user.userId)) };
    if (method === 'POST') {
        if (!['debit', 'credit'].includes(body.cardType)) return { status: 400, body: { error: 'Invalid card type' } };
        const account = await getDoc('accounts', body.linkedAccountId);
        if (!account || account.user_id !== user.userId) return { status: 404, body: { error: 'Account not found' } };
        const card = await save('cards', { user_id: user.userId, linked_account_id: body.linkedAccountId, card_number: `4000${String(Math.floor(Math.random() * 1000000000000)).padStart(12, '0')}`, card_type: body.cardType, design: body.design || 'classic', status: 'active', expiry_date: new Date(Date.now() + 3 * 365 * 86400000).toISOString(), cvv: String(Math.floor(100 + Math.random() * 900)) });
        return { status: 201, body: { message: 'Card created successfully', card: clean(card) } };
    }
    if (method === 'PATCH' && parts[1] === 'status') {
        if (!['active', 'blocked'].includes(body.status)) return { status: 400, body: { error: 'Invalid status' } };
        const card = await getDoc('cards', parts[0]);
        if (!card || card.user_id !== user.userId) return { status: 404, body: { error: 'Card not found' } };
        await getDb().collection('cards').doc(parts[0]).set({ status: body.status, updated_at: now() }, { merge: true });
        return { body: { message: `Card ${body.status} successfully` } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

async function billRoutes(method, parts, user, body) {
    if (method === 'GET' && parts[0] === 'billers') return { body: clean(await listDocs('billers', 'user_id', user.userId)) };
    if (method === 'POST' && parts[0] === 'billers') return { status: 201, body: { message: 'Biller added successfully', biller: clean(await save('billers', { user_id: user.userId, category: body.category, name: body.name, account_number: body.accountNumber, nickname: body.nickname || null })) } };
    if (method === 'GET' && parts[0] === 'payments') return { body: clean(await listDocs('bill_payments', 'user_id', user.userId)) };
    if (method === 'POST' && parts[0] === 'payments') {
        const account = await getDoc('accounts', body.fromAccountId);
        if (!account || account.user_id !== user.userId || account.status !== 'active') return { status: 404, body: { error: 'Account not found' } };
        const amount = Number(body.amount);
        if (Number(account.balance) < amount) return { status: 400, body: { error: 'Insufficient funds' } };
        const biller = await getDoc('billers', body.billerId);
        if (!biller || biller.user_id !== user.userId) return { status: 404, body: { error: 'Biller not found' } };
        const payment = await getDb().runTransaction(async transaction => {
            const accountRef = getDb().collection('accounts').doc(account.id);
            const fresh = await transaction.get(accountRef);
            const newBalance = Number((Number(fresh.data().balance) - amount).toFixed(2));
            transaction.update(accountRef, { balance: newBalance, updated_at: now() });
            const paymentId = randomUUID();
            transaction.set(getDb().collection('bill_payments').doc(paymentId), { id: paymentId, user_id: user.userId, biller_id: biller.id, from_account_id: account.id, amount, payment_date: body.paymentDate || now(), memo: body.memo || null, status: 'completed', created_at: now() });
            const txId = randomUUID();
            transaction.set(getDb().collection('transactions').doc(txId), { id: txId, account_id: account.id, type: 'bill_payment', amount: -amount, description: `Bill payment to ${biller.name}`, balance_after: newBalance, created_at: now() });
            return { paymentId, newBalance };
        });
        return { body: { message: 'Bill payment completed successfully', ...payment } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

async function externalRoutes(method, parts, user, body) {
    if (method === 'GET' && parts[0] === 'external') return { body: clean(await listDocs('external_transfers', 'user_id', user.userId)) };
    if (method === 'POST' && ['send-to-bank', 'send-to-user'].includes(parts[0])) {
        const account = await getDoc('accounts', body.fromAccountId);
        const amount = Number(body.amount);
        if (!account || account.user_id !== user.userId) return { status: 404, body: { error: 'Account not found' } };
        if (Number(account.balance) < amount) return { status: 400, body: { error: 'Insufficient funds' } };
        const newBalance = Number((Number(account.balance) - amount).toFixed(2));
        await getDb().runTransaction(async transaction => transaction.update(getDb().collection('accounts').doc(account.id), { balance: newBalance, updated_at: now() }));
        const transfer = await save('external_transfers', { user_id: user.userId, account_id: account.id, transfer_type: parts[0] === 'send-to-user' ? 'p2p' : (body.transferType || 'ach'), direction: 'outgoing', amount, recipient_name: body.accountHolderName || body.recipientEmail || '', recipient_identifier: body.accountNumber || body.recipientEmail || '', bank_name: body.bankName || null, status: 'completed', description: body.description || 'External transfer' });
        await save('transactions', { account_id: account.id, type: 'withdrawal', amount: -amount, description: transfer.description, balance_after: newBalance });
        return { body: { success: true, message: 'Transfer completed successfully', transfer: { id: transfer.id, amount, status: 'completed', newBalance } } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

async function adminRoutes(method, parts, user, body, query) {
    requireAdmin(user);

    if (method === 'GET' && parts[0] === 'dashboard') {
        const [usersSnap, accountsSnap, transactionsSnap] = await Promise.all([
            getDb().collection('users').get(),
            getDb().collection('accounts').get(),
            getDb().collection('transactions').get()
        ]);

        return {
            body: {
                stats: {
                    total_users: usersSnap.size,
                    total_accounts: accountsSnap.size,
                    total_transactions: transactionsSnap.size,
                    pending_accounts: accountsSnap.docs.filter(doc => doc.data().approval_status === 'pending').length,
                    active_users: usersSnap.docs.filter(doc => doc.data().status === 'active').length
                },
                recentActivity: []
            }
        };
    }

    if (method === 'GET' && parts[0] === 'users' && parts.length === 1) {
        const limit = Number(reqQuery(query, 'limit', 50)) || 50;
        const page = Number(reqQuery(query, 'page', 1)) || 1;
        const search = String(reqQuery(query, 'search', '') || '').trim().toLowerCase();
        const status = reqQuery(query, 'status', '');
        const role = reqQuery(query, 'role', '');

        const usersSnap = await getDb().collection('users').get();
        const rows = usersSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => item.role !== 'super_admin')
            .filter(item => !status || item.status === status)
            .filter(item => !role || item.role === role)
            .filter(item => !search || [item.first_name, item.last_name, item.email].join(' ').toLowerCase().includes(search))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

        const pageUsers = rows.slice((page - 1) * limit, page * limit).map(async (item) => {
            const accounts = await listDocs('accounts', 'user_id', item.id, null, 200);
            const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
            return {
                ...clean(item),
                account_count: accounts.length,
                total_balance: totalBalance,
                password_hash: undefined
            };
        });

        const users = await Promise.all(pageUsers);

        return {
            body: {
                users,
                total: rows.length,
                page,
                limit
            }
        };
    }

    if (method === 'GET' && parts[0] === 'users' && parts[1]) {
        const userDoc = await getDoc('users', parts[1]);
        if (!userDoc) return { status: 404, body: { error: 'User not found' } };

        const accounts = await listDocs('accounts', 'user_id', userDoc.id, null, 200);
        const recentTransactions = [];

        for (const account of accounts) {
            const tx = await listDocs('transactions', 'account_id', account.id, 'created_at', 20);
            recentTransactions.push(...tx.map(item => ({ ...item, account_number: account.account_number })));
        }

        recentTransactions.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

        return {
            body: {
                user: clean({ ...userDoc, password_hash: undefined }),
                accounts: clean(accounts),
                recentTransactions: clean(recentTransactions.slice(0, 20))
            }
        };
    }

    if (method === 'PUT' && parts[0] === 'users' && parts[1] && parts[2] === 'status') {
        const userId = parts[1];
        const { status, reason } = body;
        if (!['active', 'inactive', 'suspended'].includes(status)) {
            return { status: 400, body: { error: 'Invalid status value' } };
        }

        const user = await getDoc('users', userId);
        if (!user) return { status: 404, body: { error: 'User not found' } };

        await getDb().collection('users').doc(userId).set({ status, updated_at: now(), status_reason: reason || null }, { merge: true });

        return {
            body: {
                message: 'User status updated successfully',
                user: clean({ ...user, status, status_reason: reason || null, updated_at: now() })
            }
        };
    }

    if (method === 'GET' && parts[0] === 'accounts' && parts[1] === 'pending') {
        const accounts = await listDocs('accounts', 'status', 'inactive', 'created_at', 500);
        const pending = accounts.filter(account => account.approval_status === 'pending');

        const withUsers = await Promise.all(pending.map(async (account) => {
            const user = await getDoc('users', account.user_id);
            return {
                ...clean(account),
                first_name: user ? user.first_name : '',
                last_name: user ? user.last_name : '',
                email: user ? user.email : ''
            };
        }));

        return { body: { accounts: withUsers } };
    }

    if (method === 'POST' && parts[0] === 'accounts' && parts[1] && parts[2] === 'approve') {
        const accountId = parts[1];
        const account = await getDoc('accounts', accountId);
        if (!account) return { status: 404, body: { error: 'Account not found' } };

        const updated = await getDb().collection('accounts').doc(accountId).set({
            approval_status: 'approved',
            status: 'active',
            approved_by: user.userId,
            approved_at: now(),
            updated_at: now()
        }, { merge: true });

        return {
            body: {
                message: 'Account approved successfully',
                account: clean({ ...account, approval_status: 'approved', status: 'active', approved_by: user.userId, approved_at: now(), updated_at: now() })
            }
        };
    }

    if (method === 'POST' && parts[0] === 'accounts' && parts[1] && parts[2] === 'reject') {
        const accountId = parts[1];
        const account = await getDoc('accounts', accountId);
        if (!account) return { status: 404, body: { error: 'Account not found' } };

        const reason = body.reason || 'Rejected by admin';
        await getDb().collection('accounts').doc(accountId).set({
            approval_status: 'rejected',
            status: 'closed',
            rejection_reason: reason,
            approved_by: user.userId,
            approved_at: now(),
            updated_at: now()
        }, { merge: true });

        return {
            body: {
                message: 'Account rejected successfully',
                reason
            }
        };
    }

    if (method === 'POST' && parts[0] === 'accounts' && parts[1] && parts[2] === 'adjust-balance') {
        const accountId = parts[1];
        const amount = Number(body.amount);
        const type = body.type;
        const reason = String(body.reason || '').trim();
        const account = await getDoc('accounts', accountId);

        if (!account) return { status: 404, body: { error: 'Account not found' } };
        if (!['credit', 'debit'].includes(type) || !Number.isFinite(amount) || amount <= 0) {
            return { status: 400, body: { error: 'Adjustment details are invalid' } };
        }
        if (!reason) return { status: 400, body: { error: 'Adjustment reason is required' } };

        const balanceBefore = Number(account.balance || 0);
        const balanceAfter = Number((type === 'credit' ? balanceBefore + amount : balanceBefore - amount).toFixed(2));
        if (balanceAfter < 0) return { status: 400, body: { error: 'Adjustment would make the balance negative' } };

        const timestamp = now();
        await getDb().collection('accounts').doc(accountId).set({ balance: balanceAfter, updated_at: timestamp }, { merge: true });
        await save('transactions', {
            account_id: accountId,
            type: type === 'credit' ? 'deposit' : 'withdrawal',
            amount: type === 'credit' ? amount : -amount,
            description: `Admin adjustment: ${reason}`,
            balance_after: balanceAfter,
            approval_status: 'approved',
            created_at: timestamp
        });

        return {
            body: {
                message: 'Balance adjusted successfully',
                balanceBefore,
                balanceAfter,
                adjustment: amount,
                type,
                reason
            }
        };
    }

    if (method === 'GET' && parts[0] === 'transactions') {
        const transactions = await getDb().collection('transactions').orderBy('created_at', 'desc').limit(Number(reqQuery(query, 'limit', 50) || 50)).get();
        return { body: { transactions: transactions.docs.map(doc => clean({ id: doc.id, ...doc.data() })) } };
    }

    return { status: 404, body: { error: 'Admin route not found' } };
}

function reqQuery(body, key, fallback) {
    return body && body[key] ? body[key] : fallback;
}

async function route(req) {
    const rawPath = req.url.split('?')[0].replace(/^\/api\/?/, '') || (req.query && req.query.path);
    const parts = String(Array.isArray(rawPath) ? rawPath.join('/') : rawPath).split('/').filter(Boolean);
    const method = req.method.toUpperCase();
    const body = readBody(req);

    if (parts[0] === 'health') return { body: { status: 'OK', timestamp: now(), environment: process.env.NODE_ENV || 'production', provider: 'firebase' } };
    if (parts[0] === 'auth') {
        if (method === 'POST' && parts[1] === 'register') return authRegister(body);
        if (method === 'POST' && parts[1] === 'login') return authLogin(body);
        if (method === 'GET' && parts[1] === 'profile') {
            const user = await authenticate(req);
            return { body: clean(await userProfile(user.userId)) };
        }
    }

    const user = await authenticate(req);
    await ensureGuest();
    if (parts[0] === 'accounts') return accountRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'transactions') return transactionRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'cards') return cardRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'bills') return billRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'external-transfers') return externalRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'admin') return adminRoutes(method, parts.slice(1), user, body, req.query || {});
    if (parts[0] === 'storage' && method === 'POST' && parts[1] === 'upload-url') {
        const path = `uploads/${user.userId}/${randomUUID()}-${String(body.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const [url] = await getBucket().file(path).getSignedUrl({ action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType: body.contentType || 'application/octet-stream' });
        return { body: { path, uploadUrl: url } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
        const result = await route(req);
        res.status(result.status || 200).json(result.body);
    } catch (error) {
        console.error('Firebase API error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
};
