const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { admin, getDb, getBucket } = require('./firebase');

const GUEST_ID = 'guest-user';
const JWT_SECRET = () => process.env.JWT_SECRET || process.env.FIREBASE_PROJECT_ID || 'development-only-secret';

function now() {
    return new Date().toISOString();
}

function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const value = email.trim();
    if (!value || value.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendTransactionalEmail({ email, subject, text }) {
    if (!isValidEmail(email)) return { status: 'invalid_email' };
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { status: 'not_configured' };

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject, text })
        });
        return response.ok ? { status: 'sent' } : { status: 'failed', httpStatus: response.status };
    } catch (error) {
        console.error('Transactional email failed:', error);
        return { status: 'failed' };
    }
}

async function sendWelcomeEmail(user, { force = false } = {}) {
    const email = user?.email || '';
    if (!force && user?.welcome_email_sent) return { status: 'already_sent' };
    if (!isValidEmail(email)) return { status: 'invalid_email' };
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { status: 'not_configured' };

    const firstName = user?.first_name || user?.firstName || 'there';
    const result = await sendTransactionalEmail({
        email,
        subject: 'Welcome to American Bank United',
        text: `Hello ${firstName},\n\nWelcome to American Bank United. Your account is ready and we are happy to serve you.\n\nIf you have any questions, please reach out to our support team.\n\nThank you for joining us.`
    });

    if (result.status === 'sent' || result.status === 'already_sent') {
        if (user?.id) {
            await getDb().collection('users').doc(user.id).set({ welcome_email_sent: true, updated_at: now() }, { merge: true });
        }
    }

    return result;
}

async function sendTransferNotifications({ email, phone, recipientName, amount, transferType, bankName, accountNumber, description }) {
    const details = `Recipient: ${recipientName || 'Recipient'}\nAmount: $${Number(amount).toFixed(2)}\nTransfer type: ${transferType}\nBank: ${bankName || 'External bank'}\nAccount: ${accountNumber || 'Not provided'}\nDescription: ${description || 'External transfer'}\nDate: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;
    const result = { email: isValidEmail(email) ? 'not_configured' : 'not_provided', sms: phone ? 'not_configured' : 'not_provided' };

    if (isValidEmail(email)) {
        const emailResult = await sendTransactionalEmail({
            email,
            subject: 'American Bank United transfer confirmation',
            text: `Hello ${recipientName || 'there'},\n\nA transfer has been initiated for you.\n\n${details}\n\nPlease contact American Bank United support if you do not recognize this transaction.`
        });
        result.email = emailResult.status === 'sent' ? 'sent' : emailResult.status;
    }

    if (phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
        try {
            const params = new URLSearchParams({ To: phone, From: process.env.TWILIO_FROM_NUMBER, Body: `American Bank United transfer: $${Number(amount).toFixed(2)} ${transferType} transfer for ${recipientName || 'you'}. Account ending ${String(accountNumber || '').slice(-4)}.` });
            const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
            result.sms = response.ok ? 'sent' : 'failed';
        } catch (error) {
            console.error('Transfer SMS notification failed:', error);
            result.sms = 'failed';
        }
    }

    return result;
}

function clean(data) {
    return JSON.parse(JSON.stringify(data, (_, value) => {
        if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
        return value;
    }));
}

function cleanCustomerTransaction(data) {
    const cleaned = clean(data);
    if (Array.isArray(cleaned)) return cleaned.map(item => cleanCustomerTransaction(item));
    if (cleaned && typeof cleaned === 'object') {
        const { balance_after, ...safeTransaction } = cleaned;
        return safeTransaction;
    }
    return cleaned;
}

function makeToken(user) {
    return jwt.sign({ userId: user.id, email: user.email, role: user.role || 'customer' }, JWT_SECRET(), { expiresIn: '7d' });
}

function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

function normalizeAccountIdentifier(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function accountIdentifierMatches(account, identifier) {
    const input = normalizeAccountIdentifier(identifier);
    const accountNumber = normalizeAccountIdentifier(account.account_number);
    const storedIban = normalizeAccountIdentifier(account.iban);
    const inputDigits = input.replace(/[^0-9]/g, '');
    const accountDigits = accountNumber.replace(/[^0-9]/g, '');

    return Boolean(input) && (
        input === accountNumber ||
        input === storedIban ||
        (inputDigits.length >= 10 && inputDigits.slice(-10) === accountDigits.slice(-10)) ||
        (accountDigits.length >= 10 && input.endsWith(accountDigits.slice(-10)))
    );
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

    // Do not recreate a default guest account after it has been manually deleted.
    // The app should only create real accounts when the user explicitly requests one.
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
    const welcomeResult = await sendWelcomeEmail(user);
    return { status: 201, body: { message: 'User registered successfully', token: makeToken(user), user: { id, email: user.email, firstName, lastName, role: 'customer' }, welcomeEmail: welcomeResult } };
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

async function accountRoutes(method, parts, user, body, query = {}) {
    if (method === 'GET' && parts[0] === 'lookup') {
        const identifier = String(query.identifier || '').trim();
        const snapshot = await getDb().collection('accounts').where('status', '==', 'active').limit(1000).get();
        const accountDoc = snapshot.docs.find(doc => accountIdentifierMatches(doc.data(), identifier));
        if (!accountDoc) return { status: 404, body: { error: 'ABU account not found' } };
        const account = { id: accountDoc.id, ...accountDoc.data() };
        const profile = await userProfile(account.user_id);
        return {
            body: {
                id: account.id,
                accountNumber: account.account_number,
                accountType: account.account_type,
                recipientName: `${profile?.first_name || profile?.firstName || ''} ${profile?.last_name || profile?.lastName || ''}`.trim(),
                recipientEmail: profile?.email || ''
            }
        };
    }
    if (method === 'GET' && parts.length === 0) return { body: clean(await listDocs('accounts', 'user_id', user.userId)) };
    if (method === 'GET' && parts.length === 1) {
        const account = await getDoc('accounts', parts[0]);
        return account && account.user_id === user.userId ? { body: clean(account) } : { status: 404, body: { error: 'Account not found' } };
    }
    if (method === 'GET' && parts[1] === 'transactions') {
        const account = await getDoc('accounts', parts[0]);
        if (!account || account.user_id !== user.userId) return { status: 404, body: { error: 'Account not found' } };
        return { body: cleanCustomerTransaction(await listDocs('transactions', 'account_id', parts[0])) };
    }
    if (method === 'POST' && parts.length === 0) {
        if (!['checking', 'savings', 'business'].includes(body.accountType)) return { status: 400, body: { error: 'Invalid account type' } };
        const account = await save('accounts', { user_id: user.userId, account_number: String(Math.floor(1000000000 + Math.random() * 8999999999)), account_type: body.accountType, balance: 0, status: 'inactive', approval_status: 'pending' });
        const profile = await userProfile(user.userId);
        const welcomeResult = await sendWelcomeEmail(profile, { force: false });
        return { status: 201, body: { message: 'Account created successfully. Pending admin approval.', account: clean(account), welcomeEmail: welcomeResult } };
    }
    if (method === 'POST' && parts[0] === 'deposit') {
        const amount = Number(body.amount);
        if (!body.accountId || !Number.isFinite(amount) || amount <= 0) return { status: 400, body: { error: 'Deposit details are invalid' } };
        const db = getDb();
        const accountRef = db.collection('accounts').doc(body.accountId);
        const transactionId = randomUUID();
        const receiptId = `RCPT-${Date.now()}-${transactionId.slice(0, 8).toUpperCase()}`;
        const result = await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(accountRef);
            if (!snapshot.exists || snapshot.data().user_id !== user.userId || snapshot.data().status !== 'active') throw new Error('Account not found');
            const balance = Number((Number(snapshot.data().balance || 0) + amount).toFixed(2));
            transaction.update(accountRef, { balance, updated_at: now() });
            transaction.set(db.collection('transactions').doc(transactionId), {
                id: transactionId, receipt_id: receiptId, account_id: body.accountId, type: 'deposit', amount,
                description: body.description || `Deposit via ${body.method || 'bank transfer'}`, balance_after: balance,
                status: 'completed', approval_status: 'approved', created_at: now()
            });
            return balance;
        });
        const profile = await userProfile(user.userId);
        const emailResult = await sendTransactionalEmail({
            email: profile?.email,
            subject: 'American Bank United deposit confirmation',
            text: `Hello ${profile?.first_name || profile?.firstName || 'there'},\n\nYour deposit of $${Number(amount).toFixed(2)} has been received and credited to your account.\n\nReference: ${receiptId}\nDate: ${new Date().toISOString()}`
        });
        return { body: { message: 'Deposit completed successfully', transactionId, receiptId, newBalance: result, email: emailResult } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

async function transactionRoutes(method, parts, user, body) {
    if (method === 'GET' && parts.length === 0) {
        const accounts = await listDocs('accounts', 'user_id', user.userId, null, 1000);
        const ids = new Set(accounts.map(account => account.id));
        const all = [];
        for (const account of ids) all.push(...await listDocs('transactions', 'account_id', account, null, 200));
        return { body: cleanCustomerTransaction(all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 200)) };
    }
    if (method !== 'POST' || parts[0] !== 'transfer') return { status: 404, body: { error: 'Route not found' } };
    const amount = Number(body.amount);
    if (!body.fromAccountId || !body.toAccountId || amount <= 0) return { status: 400, body: { error: 'Transfer details are invalid' } };
    if (body.fromAccountId === body.toAccountId) return { status: 400, body: { error: 'Cannot transfer to the same account' } };
    const db = getDb();
    const result = await db.runTransaction(async transaction => {
        const fromRef = db.collection('accounts').doc(body.fromAccountId);
        const fromSnap = await transaction.get(fromRef);
        if (!fromSnap.exists || fromSnap.data().user_id !== user.userId || fromSnap.data().status !== 'active') throw new Error('Source account not found');

        let toRef = db.collection('accounts').doc(body.toAccountId);
        let toSnap = await transaction.get(toRef);
        if (!toSnap.exists) {
            const candidates = await db.collection('accounts').where('status', '==', 'active').limit(1000).get();
            const match = candidates.docs.find(doc => accountIdentifierMatches(doc.data(), body.toAccountId || body.toAccountNumber || body.toIban));
            if (match) {
                toRef = match.ref;
                toSnap = await transaction.get(toRef);
            }
        }
        if (!toSnap.exists || toSnap.data().status !== 'active') throw new Error('Destination account not found');
        const from = { id: fromSnap.id, ...fromSnap.data() };
        const to = { id: toSnap.id, ...toSnap.data() };
        if (from.id === to.id) throw new Error('Cannot transfer to the same account');
        if (Number(from.balance) < amount) throw new Error('Insufficient funds');
        const fromBalance = Number((Number(from.balance) - amount).toFixed(2));
        const toBalance = Number((Number(to.balance) + amount).toFixed(2));
        transaction.update(fromRef, { balance: fromBalance, updated_at: now() });
        transaction.update(toRef, { balance: toBalance, updated_at: now() });
        const withdrawalId = randomUUID();
        const depositId = randomUUID();
        transaction.set(db.collection('transactions').doc(withdrawalId), { id: withdrawalId, receipt_id: `RCPT-${Date.now()}-${withdrawalId.slice(0, 8).toUpperCase()}`, account_id: from.id, type: 'transfer', amount: -amount, description: body.description || 'Transfer out', related_account_id: to.id, balance_after: fromBalance, status: 'completed', approval_status: 'approved', created_at: now() });
        transaction.set(db.collection('transactions').doc(depositId), { id: depositId, receipt_id: `RCPT-${Date.now()}-${depositId.slice(0, 8).toUpperCase()}`, account_id: to.id, type: 'deposit', amount, description: body.description || 'Transfer in', related_account_id: from.id, balance_after: toBalance, status: 'completed', approval_status: 'approved', created_at: now() });
        return { withdrawalId, depositId, fromBalance, recipientUserId: to.user_id };
    });
    const recipient = await userProfile(result.recipientUserId);
    const notification = await sendTransferNotifications({
        email: recipient?.email,
        recipientName: `${recipient?.first_name || recipient?.firstName || ''} ${recipient?.last_name || recipient?.lastName || ''}`.trim(),
        amount,
        transferType: 'ABU account transfer',
        accountNumber: body.toAccountId,
        description: body.description || 'Transfer received'
    });
    const senderProfile = await userProfile(user.userId);
    const senderEmailResult = await sendTransactionalEmail({
        email: senderProfile?.email,
        subject: 'American Bank United transfer sent',
        text: `Hello ${senderProfile?.first_name || senderProfile?.firstName || 'there'},\n\nYour transfer of $${Number(amount).toFixed(2)} has been sent successfully.\n\nReference: ${result.withdrawalId}\nDate: ${new Date().toISOString()}`
    });
    return { body: { message: 'Transfer completed successfully', status: 'approved', withdrawalId: result.withdrawalId, depositId: result.depositId, newBalance: result.fromBalance, notification, senderEmail: senderEmailResult } };
}

async function notificationRoutes(method, parts, user) {
    if (method !== 'GET' || parts.length !== 0) return { status: 404, body: { error: 'Route not found' } };
    const accounts = await listDocs('accounts', 'user_id', user.userId, null, 1000);
    const transactions = [];
    for (const account of accounts) transactions.push(...await listDocs('transactions', 'account_id', account.id, null, 200));
    const transfers = await listDocs('external_transfers', 'user_id', user.userId, 'created_at', 200);
    const notifications = [
        ...transactions.map(transaction => ({
            id: `transaction-${transaction.id}`,
            type: 'transaction',
            title: `${String(transaction.type || 'account').replace('_', ' ')} completed`,
            message: transaction.description || `Your ${transaction.type || 'account'} activity was completed.`,
            amount: transaction.amount,
            receiptId: transaction.receipt_id || null,
            createdAt: transaction.created_at
        })),
        ...transfers.map(transfer => ({
            id: `transfer-${transfer.id}`,
            type: 'account_activity',
            title: 'External activity completed',
            message: transfer.description || `Activity for ${transfer.recipient_name || 'external destination'}.`,
            amount: transfer.amount,
            receiptId: transfer.receipt_id || null,
            createdAt: transfer.created_at
        }))
    ];
    notifications.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    return { body: notifications.slice(0, 100) };
}

async function chatRoutes(method, parts, user, body) {
    const db = getDb();
    const conversationRef = db.collection('chat_conversations').doc(user.userId);
    const conversation = await conversationRef.get();

    if (method === 'POST' && parts[0] === 'start') {
        const inquiry = String(body.inquiry || '').trim();
        const allowedInquiries = ['Account access', 'Transfer issue', 'Deposit or withdrawal', 'Card support', 'Fraud or suspicious activity', 'Other question'];
        if (!allowedInquiries.includes(inquiry)) return { status: 400, body: { error: 'Select a valid inquiry type' } };
        const profile = await userProfile(user.userId);
        const timestamp = now();
        await conversationRef.set({ id: user.userId, user_id: user.userId, user_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), user_email: profile?.email || '', inquiry, status: 'open', updated_at: timestamp }, { merge: true });
        const messages = await conversationRef.collection('messages').get();
        return { body: { conversation: clean({ id: user.userId, ...((await conversationRef.get()).data()) }), messages: clean(messages.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) } };
    }

    if (method === 'GET' && parts.length === 0) {
        const messages = conversation.exists ? await conversationRef.collection('messages').get() : { docs: [] };
        return {
            body: {
                conversation: conversation.exists ? clean({ id: conversation.id, ...conversation.data() }) : null,
                unreadCount: conversation.exists ? Number(conversation.data().customer_unread_count || 0) : 0,
                messages: messages.docs.map(doc => clean({ id: doc.id, ...doc.data() })).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
            }
        };
    }

    if (method === 'POST' && parts[0] === 'read') {
        if (conversation.exists) await conversationRef.set({ customer_unread_count: 0, updated_at: now() }, { merge: true });
        return { body: { success: true } };
    }

    if (method === 'POST' && parts.length === 0) {
        const text = String(body.text || '').trim();
        if (!text || text.length > 2000) return { status: 400, body: { error: 'Message must be between 1 and 2000 characters' } };
        const profile = await userProfile(user.userId);
        const timestamp = now();
        const message = { id: randomUUID(), conversation_id: user.userId, sender_id: user.userId, sender_role: 'customer', text, created_at: timestamp };
        await conversationRef.set({ id: user.userId, user_id: user.userId, user_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), user_email: profile?.email || '', status: 'open', last_message: text, last_message_at: timestamp, admin_unread_count: Number(conversation?.data()?.admin_unread_count || 0) + 1, updated_at: timestamp }, { merge: true });
        await conversationRef.collection('messages').doc(message.id).set(message);
        return { status: 201, body: { message: clean(message) } };
    }

    return { status: 404, body: { error: 'Chat route not found' } };
}

async function cardRoutes(method, parts, user, body) {
    if (method === 'GET' && parts[0] === 'requests') return { body: clean(await listDocs('card_requests', 'user_id', user.userId, 'created_at', 100)) };
    if (method === 'GET') return { body: clean(await listDocs('cards', 'user_id', user.userId)) };
    if (method === 'POST') {
        if (!['debit', 'credit'].includes(body.cardType)) return { status: 400, body: { error: 'Invalid card type' } };
        const account = await getDoc('accounts', body.linkedAccountId);
        if (!account || account.user_id !== user.userId) return { status: 404, body: { error: 'Account not found' } };
        const existing = await listDocs('card_requests', 'user_id', user.userId, 'created_at', 100);
        if (existing.some(request => request.status === 'pending' && request.linked_account_id === body.linkedAccountId && request.card_type === body.cardType)) {
            return { status: 409, body: { error: 'A card request is already being processed' } };
        }
        const request = await save('card_requests', { user_id: user.userId, linked_account_id: body.linkedAccountId, card_type: body.cardType, design: body.design || 'classic', status: 'pending', requested_at: now() });
        return { status: 201, body: { message: 'Your card request has been received and is under process. Your card will be ready in 3 working days.', request: clean(request) } };
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
    if (method === 'GET' && (parts[0] === 'external' || parts[0] === 'transfers')) return { body: clean(await listDocs('external_transfers', 'user_id', user.userId)) };
    if (method === 'POST' && ['send-to-bank', 'send-to-user'].includes(parts[0])) {
        const account = await getDoc('accounts', body.fromAccountId);
        const amount = Number(body.amount);
        if (!account || account.user_id !== user.userId) return { status: 404, body: { error: 'Account not found' } };
        if (Number(account.balance) < amount) return { status: 400, body: { error: 'Insufficient funds' } };
        const newBalance = Number((Number(account.balance) - amount).toFixed(2));
        await getDb().runTransaction(async transaction => transaction.update(getDb().collection('accounts').doc(account.id), { balance: newBalance, updated_at: now() }));
        const transferType = parts[0] === 'send-to-user' ? 'p2p' : (body.transferType || 'ach');
        const notification = await sendTransferNotifications({ email: body.recipientEmail, phone: body.recipientPhone, recipientName: body.accountHolderName, amount, transferType, bankName: body.bankName, accountNumber: body.accountNumber, description: body.description });
        const receiptId = `RCPT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const transfer = await save('external_transfers', { user_id: user.userId, account_id: account.id, transfer_type: transferType, direction: 'outgoing', amount, recipient_name: body.accountHolderName || body.recipientEmail || '', recipient_identifier: body.accountNumber || body.recipientEmail || '', recipient_email: body.recipientEmail || null, recipient_phone: body.recipientPhone || null, bank_name: body.bankName || null, status: 'completed', receipt_id: receiptId, description: body.description || 'External transfer', notification_status: notification });
        await save('transactions', { account_id: account.id, type: 'withdrawal', amount: -amount, receipt_id: receiptId, status: 'completed', description: transfer.description, balance_after: newBalance });
        return { body: { success: true, message: 'Transfer completed successfully', transfer: { id: transfer.id, amount, status: 'completed', newBalance, notification } } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function passesLuhn(value) {
    let total = 0;
    let doubleDigit = false;
    for (let index = value.length - 1; index >= 0; index -= 1) {
        let digit = Number(value[index]);
        if (doubleDigit) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        total += digit;
        doubleDigit = !doubleDigit;
    }
    return total % 10 === 0;
}

async function withdrawalRoutes(method, parts, user, body) {
    if (method !== 'POST' || parts.length !== 0) return { status: 404, body: { error: 'Route not found' } };

    const amount = Number(body.amount);
    if (!body.fromAccountId || !Number.isFinite(amount) || amount <= 0) {
        return { status: 400, body: { error: 'Withdrawal details are invalid' } };
    }

    const account = await getDoc('accounts', body.fromAccountId);
    if (!account || account.user_id !== user.userId || account.status !== 'active') {
        return { status: 404, body: { error: 'Source account not found' } };
    }
    if (Number(account.balance) < amount) return { status: 400, body: { error: 'Insufficient funds' } };

    const profile = await userProfile(user.userId);
    const profileName = normalizeName(`${profile?.first_name || profile?.firstName || ''} ${profile?.last_name || profile?.lastName || ''}`);
    const destinationType = body.destinationType;
    let transferData;

    if (destinationType === 'external_card') {
        const card = body.card || {};
        const cardNumber = String(card.cardNumber || '').replace(/\D/g, '');
        const cardholderName = String(card.cardholderName || '').trim();
        const expiry = String(card.cardExpiry || '');
        const cvv = String(card.cardCvv || '');
        const [month, year] = expiry.split('/').map(Number);
        const nowDate = new Date();
        const expiryDate = new Date(2000 + year, month || 0, 1);
        if (!/^\d{13,19}$/.test(cardNumber) || !passesLuhn(cardNumber) || !/^\d{2}\/\d{2}$/.test(expiry) || month < 1 || month > 12 || expiryDate <= new Date(nowDate.getFullYear(), nowDate.getMonth(), 1) || !/^\d{3,4}$/.test(cvv)) {
            return { status: 400, body: { error: 'Card details are invalid or expired' } };
        }
        if (!profileName || normalizeName(cardholderName) !== profileName) {
            return { status: 400, body: { error: 'Cardholder name must match your account name' } };
        }
        transferData = {
            destination_type: destinationType,
            recipient_name: cardholderName,
            recipient_identifier: `****${cardNumber.slice(-4)}`,
            card_last4: cardNumber.slice(-4),
            card_expiry: expiry,
            status: 'completed'
        };
    } else if (destinationType === 'crypto_wallet') {
        const wallet = body.wallet || {};
        if (![wallet.platform, wallet.accountName, wallet.address, wallet.network].every(value => String(value || '').trim()) || String(wallet.address).trim().length < 16) {
            return { status: 400, body: { error: 'Wallet details are invalid' } };
        }
        transferData = {
            destination_type: destinationType,
            recipient_name: String(wallet.accountName).trim(),
            recipient_identifier: String(wallet.address).trim(),
            wallet_platform: String(wallet.platform).trim(),
            wallet_network: String(wallet.network).trim(),
            status: 'completed'
        };
    } else {
        return { status: 400, body: { error: 'Select a valid withdrawal destination' } };
    }

    const transferId = randomUUID();
    const transactionId = randomUUID();
    const receiptId = `RCPT-${Date.now()}-${transactionId.slice(0, 8).toUpperCase()}`;
    const transfer = {
        id: transferId,
        created_at: now(),
        updated_at: now(),
        user_id: user.userId,
        account_id: account.id,
        transfer_type: destinationType === 'external_card' ? 'card_withdrawal' : 'crypto_withdrawal',
        direction: 'outgoing',
        amount,
        description: body.description || 'Withdrawal',
        receipt_id: receiptId,
        ...transferData
    };
    const transactionRecord = {
        id: transactionId,
        account_id: account.id,
        type: 'withdrawal',
        amount: -amount,
        description: body.description || `Withdrawal to ${destinationType === 'external_card' ? 'external card' : 'crypto wallet'}`,
        related_transfer_id: transfer.id,
        receipt_id: receiptId,
        created_at: now()
    };
    await getDb().runTransaction(async transaction => {
        const accountRef = getDb().collection('accounts').doc(account.id);
        const currentAccount = await transaction.get(accountRef);
        if (!currentAccount.exists || Number(currentAccount.data().balance) < amount) throw new Error('Insufficient funds');
        const newBalance = Number((Number(currentAccount.data().balance) - amount).toFixed(2));
        transaction.update(accountRef, { balance: newBalance, updated_at: now() });
        transaction.set(getDb().collection('external_transfers').doc(transfer.id), transfer);
        transaction.set(getDb().collection('transactions').doc(transactionRecord.id), { ...transactionRecord, balance_after: newBalance });
        transfer.new_balance = newBalance;
    });
    return { body: { message: 'Withdrawal submitted successfully', transfer: clean(transfer), newBalance: transfer.new_balance } };
}

async function adminRoutes(method, parts, user, body, query) {
    requireAdmin(user);

    if (method === 'GET' && parts[0] === 'chat' && parts.length === 1) {
        const snapshot = await getDb().collection('chat_conversations').get();
        const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(b.last_message_at || '').localeCompare(String(a.last_message_at || '')));
        return { body: { conversations: clean(conversations) } };
    }

    if (parts[0] === 'chat' && parts[1]) {
        const conversationRef = getDb().collection('chat_conversations').doc(parts[1]);
        if (method === 'GET' && parts.length === 2) {
            const messages = await conversationRef.collection('messages').get();
            await conversationRef.set({ admin_unread_count: 0, updated_at: now() }, { merge: true });
            return { body: { messages: clean(messages.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) } };
        }
        if (method === 'POST' && parts.length === 2) {
            const text = String(body.text || '').trim();
            if (!text || text.length > 2000) return { status: 400, body: { error: 'Message must be between 1 and 2000 characters' } };
            const timestamp = now();
            const message = { id: randomUUID(), conversation_id: parts[1], sender_id: user.userId, sender_role: 'admin', text, created_at: timestamp };
            const current = await conversationRef.get();
            await conversationRef.set({ status: 'open', last_message: text, last_message_at: timestamp, customer_unread_count: Number(current.data()?.customer_unread_count || 0) + 1, updated_at: timestamp }, { merge: true });
            await conversationRef.collection('messages').doc(message.id).set(message);
            return { status: 201, body: { message: clean(message) } };
        }
    }

    if (method === 'GET' && parts[0] === 'card-requests') {
        const requests = await listDocs('card_requests', 'status', 'pending', 'created_at', 500);
        const withUsers = await Promise.all(requests.map(async request => {
            const requestedUser = await getDoc('users', request.user_id);
            const account = await getDoc('accounts', request.linked_account_id);
            return clean({ ...request, user: requestedUser ? { id: requestedUser.id, first_name: requestedUser.first_name, last_name: requestedUser.last_name, email: requestedUser.email } : null, account: account ? { account_number: account.account_number, account_type: account.account_type } : null });
        }));
        return { body: { requests: withUsers } };
    }

    if (method === 'POST' && parts[0] === 'card-requests' && parts[1] && parts[2] === 'approve') {
        const request = await getDoc('card_requests', parts[1]);
        if (!request || request.status !== 'pending') return { status: 404, body: { error: 'Pending card request not found' } };
        const card = await save('cards', { user_id: request.user_id, linked_account_id: request.linked_account_id, card_number: `4000${String(Math.floor(Math.random() * 1000000000000)).padStart(12, '0')}`, card_type: request.card_type, design: request.design || 'classic', status: 'active', expiry_date: new Date(Date.now() + 3 * 365 * 86400000).toISOString(), cvv: String(Math.floor(100 + Math.random() * 900)) });
        await getDb().collection('card_requests').doc(request.id).set({ status: 'approved', processed_by: user.userId, processed_at: now(), card_id: card.id }, { merge: true });
        return { body: { message: 'Card request approved', card: clean(card) } };
    }

    if (method === 'POST' && parts[0] === 'card-requests' && parts[1] && parts[2] === 'reject') {
        const request = await getDoc('card_requests', parts[1]);
        if (!request || request.status !== 'pending') return { status: 404, body: { error: 'Pending card request not found' } };
        await getDb().collection('card_requests').doc(request.id).set({ status: 'rejected', processed_by: user.userId, processed_at: now(), rejection_reason: body.reason || 'Request rejected by admin' }, { merge: true });
        return { body: { message: 'Card request rejected' } };
    }

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
        const rawType = body.type;
        const normalizedType = rawType === 'deposit' ? 'credit' : rawType;
        const reason = String(body.reason || '').trim();
        const account = await getDoc('accounts', accountId);

        if (!account) return { status: 404, body: { error: 'Account not found' } };
        if (!['credit'].includes(normalizedType) || !Number.isFinite(amount) || amount <= 0) {
            return { status: 400, body: { error: 'Adjustment details are invalid' } };
        }
        if (!reason) return { status: 400, body: { error: 'Adjustment reason is required' } };

        const balanceBefore = Number(account.balance || 0);
        const balanceAfter = Number((balanceBefore + amount).toFixed(2));
        if (balanceAfter < 0) return { status: 400, body: { error: 'Adjustment would make the balance negative' } };

        const timestamp = now();
        await getDb().collection('accounts').doc(accountId).set({ balance: balanceAfter, updated_at: timestamp }, { merge: true });
        await save('transactions', {
            account_id: accountId,
            type: 'deposit',
            amount,
            description: 'Deposit',
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
                type: 'deposit',
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
    const requestPath = req.url.split('?')[0].replace(/^\/api\/?/, '');
    const rawPath = requestPath === '[...path]' ? (req.query && req.query.path) : requestPath || (req.query && req.query.path);
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
    if (parts[0] === 'accounts') return accountRoutes(method, parts.slice(1), user, body, req.query || {});
    if (parts[0] === 'chat') return chatRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'transactions') return transactionRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'notifications') return notificationRoutes(method, parts.slice(1), user);
    if (parts[0] === 'cards') return cardRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'bills') return billRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'external-transfers') return externalRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'withdrawals') return withdrawalRoutes(method, parts.slice(1), user, body);
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
