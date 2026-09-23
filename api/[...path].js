const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomInt, randomUUID } = require('crypto');
const { admin, getDb, getBucket } = require('../lib/firebase');

const GUEST_ID = 'guest-user';
const JWT_SECRET = () => process.env.JWT_SECRET || process.env.FIREBASE_PROJECT_ID || 'development-only-secret';
const CHAT_ATTACHMENT_MAX_BYTES = 512 * 1024;
let guestCheckedAt = 0;

function now() {
    return new Date().toISOString();
}

function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const value = email.trim();
    if (!value || value.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendTransactionalEmail({ email, subject, text, html }) {
    if (!isValidEmail(email)) return { status: 'invalid_email' };
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { status: 'not_configured' };

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject, text, ...(html ? { html } : {}) })
        });
        return response.ok ? { status: 'sent' } : { status: 'failed', httpStatus: response.status };
    } catch (error) {
        console.error('Transactional email failed:', error);
        return { status: 'failed' };
    }
}

async function sendSmsNotification({ phone, body }) {
    if (!phone) return 'not_provided';
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) return 'not_configured';

    try {
        const params = new URLSearchParams({ To: String(phone).trim(), From: process.env.TWILIO_FROM_NUMBER, Body: body });
        const credentials = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });
        return response.ok ? 'sent' : 'failed';
    } catch (error) {
        console.error('SMS notification failed:', error);
        return 'failed';
    }
}

function verificationEmailMarkup({ firstName, label, code, subject }) {
    const greeting = escapeEmailHtml(firstName || 'there');
    const safeLabel = escapeEmailHtml(label);
    const safeCode = escapeEmailHtml(code);
    const safeSubject = escapeEmailHtml(subject);
    return `<div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:32px;color:#172033"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbe3ec;border-radius:16px;overflow:hidden"><div style="background:#111827;color:#fff;padding:24px 28px"><img src="https://americanbankunited.com/assets/abu-logo.png" width="150" alt="American Bank United" style="display:block;width:150px;height:auto;margin:0 0 16px"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.75">American Bank United</div><h1 style="font-size:22px;margin:10px 0 0">Secure verification</h1></div><div style="padding:28px"><p style="font-size:16px">Hello ${greeting},</p><p>Use the verification code below to complete your ${safeLabel}.</p><div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;text-align:center;padding:18px;margin:22px 0"><div style="font-size:12px;color:#64748b;text-transform:uppercase">Your verification code</div><strong style="display:block;font-size:32px;letter-spacing:8px;margin-top:8px;color:#111827">${safeCode}</strong></div><p style="color:#64748b;font-size:13px">This code expires in 10 minutes and can be used once. If you did not request this ${safeLabel}, contact American Bank United support immediately.</p><p style="color:#64748b;font-size:13px">Never share this code with anyone, including support.</p></div><div style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">${safeSubject}<br>This is an automated security message from American Bank United.</div></div></div>`;
}

function escapeEmailHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function maskAccountNumber(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return 'Not provided';
    const visible = normalized.slice(-4);
    return `${'*'.repeat(Math.max(0, normalized.length - 4))}${visible}`;
}

async function sendAccountTransactionAlert({ email, phone, firstName, direction, amount, sender, receiver, reference, description, transferType, bankCharge = 0 }) {
    const isCredit = direction === 'credit';
    const amountText = `$${Number(amount || 0).toFixed(2)}`;
    const chargeText = `$${Number(bankCharge || 0).toFixed(2)}`;
    const title = isCredit ? 'Funds credited to your account' : 'Funds debited from your account';
    const subject = `American Bank United ${isCredit ? 'credit' : 'debit'} alert: ${amountText}`;
    const greeting = firstName || 'there';
    const senderDetails = sender || {};
    const receiverDetails = receiver || {};
    const partyText = (label, party) => `${label}: ${party.name || 'Not provided'} | Account ${maskAccountNumber(party.accountNumber)} | Bank ${party.bank || 'American Bank United'}`;
    const plainText = `Hello ${greeting},\n\n${title}.\n\nAmount: ${amountText}\nBank charge: ${chargeText}\nTransaction type: ${transferType || 'Account transaction'}\nDescription: ${description || 'American Bank United transaction'}\n${partyText('Sender', senderDetails)}\n${partyText('Receiver', receiverDetails)}\nReference number: ${reference || 'Pending'}\n\nIf you do not recognize this activity, contact American Bank United support immediately.\n\nAmerican Bank United`;
    const partyRow = (label, party) => `<tr><td style="padding:7px 0;color:#64748b">${label}</td><td style="padding:7px 0;text-align:right">${escapeEmailHtml(party.name || 'Not provided')}<br>Account ${escapeEmailHtml(maskAccountNumber(party.accountNumber))}<br>${escapeEmailHtml(party.bank || 'American Bank United')}</td></tr>`;
    const html = `<div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:32px;color:#172033"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #dbe3ec;border-radius:16px;overflow:hidden"><div style="background:#111827;color:#fff;padding:24px 28px"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.75">American Bank United</div><h1 style="font-size:22px;margin:10px 0 0">${title}</h1></div><div style="padding:28px"><p style="font-size:16px">Hello ${escapeEmailHtml(greeting)},</p><p>Your ABU transaction has been recorded successfully.</p><div style="background:${isCredit ? '#ecfdf5' : '#fff7ed'};border:1px solid ${isCredit ? '#a7f3d0' : '#fed7aa'};border-radius:12px;padding:18px;margin:22px 0"><div style="font-size:12px;color:#64748b;text-transform:uppercase">${isCredit ? 'Credit' : 'Debit'} amount</div><strong style="display:block;font-size:30px;margin-top:5px;color:${isCredit ? '#047857' : '#c2410c'}">${amountText}</strong></div><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:7px 0;color:#64748b">Transaction type</td><td style="padding:7px 0;text-align:right">${escapeEmailHtml(transferType || 'Account transaction')}</td></tr><tr><td style="padding:7px 0;color:#64748b">Description</td><td style="padding:7px 0;text-align:right">${escapeEmailHtml(description || 'ABU transaction')}</td></tr>${partyRow('Sender', senderDetails)}${partyRow('Receiver', receiverDetails)}<tr><td style="padding:7px 0;color:#64748b">Bank charge</td><td style="padding:7px 0;text-align:right">${chargeText}</td></tr><tr><td style="padding:7px 0;color:#64748b">Reference number</td><td style="padding:7px 0;text-align:right">${escapeEmailHtml(reference || 'Pending')}</td></tr></table><p style="font-size:13px;color:#64748b;margin-top:24px">If you do not recognize this activity, contact American Bank United support immediately. Never share your password or transfer PIN.</p></div><div style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px">This is an automated transaction alert from American Bank United.</div></div></div>`;
    const brandedHtml = html.replace(
        '<div style="background:#111827;color:#fff;padding:24px 28px"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.75">American Bank United</div>',
        '<div style="background:#111827;color:#fff;padding:24px 28px"><img src="https://americanbankunited.com/assets/abu-logo.png" width="150" alt="American Bank United" style="display:block;width:150px;height:auto;margin:0 0 16px"><div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.75">American Bank United</div>'
    );
    const smsText = `American Bank United: ${isCredit ? 'Credit' : 'Debit'} of ${amountText}. ${transferType || 'Account transaction'}. Ref ${reference || 'Pending'}. Account ending ${String((isCredit ? receiverDetails.accountNumber : senderDetails.accountNumber) || '').slice(-4)}.`;
    const [emailStatus, smsStatus] = await Promise.all([
        isValidEmail(email) ? sendTransactionalEmail({ email, subject, text: plainText, html: brandedHtml }).then(result => result.status === 'sent' ? 'sent' : result.status) : Promise.resolve('not_provided'),
        sendSmsNotification({ phone, body: smsText })
    ]);
    return { email: emailStatus, sms: smsStatus };
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

    result.sms = await sendSmsNotification({ phone, body: `American Bank United transfer: $${Number(amount).toFixed(2)} ${transferType} transfer for ${recipientName || 'you'}. Account ending ${String(accountNumber || '').slice(-4)}.` });

    return result;
}

function clean(data) {
    return JSON.parse(JSON.stringify(data, (_, value) => {
        if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
        return value;
    }));
}

function normalizeAdminTransferReceipt(transaction) {
    const adminTransferTypes = ['internal_admin_transfer', 'other_bank_funds', 'international_transfer'];
    if (!transaction?.receipt_data || !adminTransferTypes.includes(transaction.transfer_type)) return transaction;
    return {
        ...transaction,
        receipt_data: {
            ...transaction.receipt_data,
            senderName: transaction.sender_name || transaction.source_name || transaction.receipt_data.senderName || 'American Bank United Admin',
            senderBankName: transaction.sender_bank_name || transaction.bank_name || transaction.receipt_data.senderBankName || 'American Bank United',
            senderAccountNumber: transaction.receipt_data.senderAccountNumber || 'American Bank United admin account',
            recipientBank: 'American Bank United',
            bank: 'American Bank United'
        }
    };
}

function cleanCustomerTransaction(data) {
    const cleaned = clean(data);
    if (Array.isArray(cleaned)) return cleaned.map(item => cleanCustomerTransaction(item));
    if (cleaned && typeof cleaned === 'object') {
        const { balance_after, ...safeTransaction } = normalizeAdminTransferReceipt(cleaned);
        return safeTransaction;
    }
    return cleaned;
}

function makeToken(user) {
    return jwt.sign({ userId: user.id, email: user.email, role: user.role || 'customer', sessionVersion: Number(user.session_version || 0) }, JWT_SECRET(), { expiresIn: '7d' });
}

function readBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    return {};
}

function normalizeChatAttachment(value) {
    if (!value) return null;
    if (typeof value !== 'object') throw new Error('Invalid attachment');
    const name = String(value.name || '').trim();
    const type = String(value.type || 'application/octet-stream').trim().toLowerCase();
    const data = String(value.data || '');
    if (!name || name.length > 120 || !data.startsWith(`data:${type};base64,`)) throw new Error('Invalid attachment');
    const base64 = data.slice(`data:${type};base64,`.length);
    const allowedType = type.startsWith('image/') || ['application/pdf', 'application/json', 'text/plain', 'text/csv'].includes(type);
    if (!allowedType || !base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('This file type is not supported');
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length || bytes.length > CHAT_ATTACHMENT_MAX_BYTES) throw new Error('Files must be 512 KB or smaller');
    return { name, type, size: bytes.length, data };
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
        (inputDigits.length >= 6 && accountDigits.endsWith(inputDigits))
    );
}

function isTransferableAccount(account) {
    const status = String(account?.status || '').toLowerCase();
    return (!status || ['active', 'approved'].includes(status)) && String(account?.approval_status || 'approved').toLowerCase() === 'approved';
}

async function authenticate(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || token === 'guest-token') {
        return { userId: GUEST_ID, email: 'guest@americanbankunited.local', role: 'customer' };
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET());
        if (payload.sessionVersion !== undefined) {
            const profile = await userProfile(payload.userId);
            if (Number(profile?.session_version || 0) !== Number(payload.sessionVersion)) {
                const err = new Error('Your session has ended. Please sign in again.');
                err.status = 401;
                throw err;
            }
        }
        return payload;
    } catch (error) {
        const err = new Error('Invalid or expired token');
        err.status = 401;
        throw err;
    }
}

async function verifyTransferPin(user, pin) {
    if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in before making a transfer' } };
    const profile = await userProfile(user.userId);
    if (!profile) return { status: 404, body: { error: 'User profile not found' } };
    if (profile.status === 'suspended' || profile.transfer_pin_locked) return { status: 403, body: { error: 'Your account is restricted after too many incorrect PIN attempts. Contact support.' } };
    if (!profile.transfer_pin_hash) return { status: 409, body: { error: 'Set your 4-digit transfer PIN before making a transfer', code: 'PIN_NOT_SET' } };
    const valid = await bcrypt.compare(String(pin || ''), profile.transfer_pin_hash);
    if (valid) {
        await getDb().collection('users').doc(user.userId).set({ transfer_pin_failures: 0, updated_at: now() }, { merge: true });
        return null;
    }
    const policy = await getApprovalPolicy();
    const failures = Number(profile.transfer_pin_failures || 0) + 1;
    const locked = failures >= policy.maxPinAttempts;
    await getDb().collection('users').doc(user.userId).set({ transfer_pin_failures: failures, transfer_pin_locked: locked, status: locked ? 'suspended' : profile.status, updated_at: now() }, { merge: true });
    return { status: 403, body: { error: locked ? `Your account is restricted after ${policy.maxPinAttempts} incorrect PIN attempts. Contact support.` : `Incorrect transfer PIN. ${policy.maxPinAttempts - failures} attempt(s) remaining.`, attemptsRemaining: Math.max(0, policy.maxPinAttempts - failures) } };
}

async function transferPinRoutes(method, parts, user, body) {
    if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in before setting a transfer PIN' } };
    const profile = await userProfile(user.userId);
    if (profile?.status === 'suspended' || profile?.transfer_pin_locked) return { status: 403, body: { error: 'Your account is restricted. Contact support.' } };
    if (method === 'GET' && parts.length === 0) return { body: { configured: Boolean(profile?.transfer_pin_hash), locked: Boolean(profile?.transfer_pin_locked), failures: Number(profile?.transfer_pin_failures || 0) } };
    if (method === 'POST' && parts.length === 0) {
        const pin = String(body.pin || '');
        if (!/^\d{4}$/.test(pin)) return { status: 400, body: { error: 'Transfer PIN must be exactly 4 digits' } };
        if (profile?.transfer_pin_hash) return { status: 409, body: { error: 'Transfer PIN is already configured' } };
        await getDb().collection('users').doc(user.userId).set({ transfer_pin_hash: await bcrypt.hash(pin, 12), transfer_pin_failures: 0, transfer_pin_locked: false, updated_at: now() }, { merge: true });
        return { status: 201, body: { message: 'Transfer PIN set successfully' } };
    }
    return { status: 404, body: { error: 'Transfer PIN route not found' } };
}

const securityCodeSettings = {
    password: { label: 'password reset', subject: 'Your American Bank United password reset code' },
    'transfer-pin': { label: 'Transfer PIN reset', subject: 'Your American Bank United Transfer PIN code' },
    'two-step': { label: 'two-step verification', subject: 'Your American Bank United verification code' }
};

function securityCodeId(userId, purpose) {
    return `${userId}_${purpose}`;
}

async function recordSecurityEvent(user, action, purpose, metadata = {}) {
    try {
        await save('security_audit', { user_id: user.userId, action_type: action, purpose, metadata, created_at: now() });
    } catch (error) {
        console.error('Security audit write failed:', error);
    }
}

async function securityCodeRoutes(method, parts, user, body) {
    if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in before changing security settings' } };
    const purpose = parts[0];
    const action = parts[1];
    const settings = securityCodeSettings[purpose];
    if (!settings || !['request', 'confirm'].includes(action)) return { status: 404, body: { error: 'Security verification route not found' } };
    const verificationRef = getDb().collection('security_verifications').doc(securityCodeId(user.userId, purpose));

    if (method === 'POST' && action === 'request') {
        const profile = await userProfile(user.userId);
        if (!isValidEmail(profile?.email)) return { status: 400, body: { error: 'A valid account email is required for verification' } };
        const existing = await verificationRef.get();
        const existingRecord = existing.exists ? existing.data() : null;
        if (existingRecord?.requested_at && Date.now() - Date.parse(existingRecord.requested_at) < 60 * 1000) {
            return { status: 429, body: { error: 'Please wait before requesting another verification code' } };
        }
        const code = String(randomInt(0, 1000000)).padStart(6, '0');
        await verificationRef.set({ purpose, code_hash: await bcrypt.hash(code, 12), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), attempts: 0, requested_at: now(), created_at: now() });
        const delivery = await sendTransactionalEmail({
            email: profile.email,
            subject: settings.subject,
            text: `Hello ${profile.first_name || 'there'},\n\nYour six-digit ${settings.label} code is: ${code}\n\nThis code expires in 10 minutes and can be used once. If you did not request this, contact American Bank United support immediately. Never share this code with anyone.`,
            html: verificationEmailMarkup({ firstName: profile.first_name, label: settings.label, code, subject: settings.subject })
        });
        if (delivery.status !== 'sent') {
            await verificationRef.delete();
            return { status: 503, body: { error: 'Unable to send the verification email. Please try again later.' } };
        }
        await recordSecurityEvent(user, 'SECURITY_CODE_SENT', purpose);
        return { body: { message: `Verification code sent to ${profile.email.replace(/(^.).*(@.*$)/, '$1***$2')}`, expiresIn: 600 } };
    }

    if (method !== 'POST' || action !== 'confirm') return { status: 405, body: { error: 'Security verification method not allowed' } };
    const verification = await verificationRef.get();
    const record = verification.exists ? verification.data() : null;
    if (!record || !record.expires_at || Date.now() > Date.parse(record.expires_at)) return { status: 410, body: { error: 'That verification code has expired. Request a new code.' } };
    if (Number(record.attempts || 0) >= 5) return { status: 429, body: { error: 'Too many incorrect codes. Request a new code.' } };
    if (!/^\d{6}$/.test(String(body.code || '')) || !(await bcrypt.compare(String(body.code), record.code_hash))) {
        await verificationRef.set({ attempts: Number(record.attempts || 0) + 1 }, { merge: true });
        await recordSecurityEvent(user, 'SECURITY_CODE_FAILED', purpose, { attempts: Number(record.attempts || 0) + 1 });
        return { status: 403, body: { error: 'Incorrect verification code' } };
    }

    const userRef = getDb().collection('users').doc(user.userId);
    if (purpose === 'password') {
        const password = String(body.newPassword || '');
        if (password.length < 8) return { status: 400, body: { error: 'Password must be at least 8 characters' } };
        const profile = await userProfile(user.userId);
        await userRef.set({ password_hash: await bcrypt.hash(password, 12), session_version: Number(profile?.session_version || 0) + 1, updated_at: now() }, { merge: true });
    } else if (purpose === 'transfer-pin') {
        const pin = String(body.pin || '');
        if (!/^\d{4}$/.test(pin)) return { status: 400, body: { error: 'Transfer PIN must be exactly 4 digits' } };
        await userRef.set({ transfer_pin_hash: await bcrypt.hash(pin, 12), transfer_pin_failures: 0, transfer_pin_locked: false, updated_at: now() }, { merge: true });
    } else {
        await userRef.set({ two_factor_enabled: body.enabled !== false, updated_at: now() }, { merge: true });
    }
    await verificationRef.delete();
    await recordSecurityEvent(user, 'SECURITY_SETTING_CHANGED', purpose, purpose === 'two-step' ? { enabled: body.enabled !== false } : {});
    return { body: { message: `${settings.label} updated successfully` } };
}

async function preferenceRoutes(method, user, body) {
    const defaults = { productUpdates: false, personalizedExperience: true, activityAlerts: true, transactionAlerts: true, supportMessages: true, reduceMotion: false, currency: 'USD' };
    if (method === 'GET') {
        if (user.userId === GUEST_ID) return { body: { preferences: defaults } };
        const profile = await userProfile(user.userId);
        return { body: { preferences: { ...defaults, ...(profile?.preferences || {}) } } };
    }
    if (method !== 'PATCH') return { status: 405, body: { error: 'Preference method not allowed' } };
    if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in before updating preferences' } };
    const booleanKeys = Object.keys(defaults).filter(key => typeof defaults[key] === 'boolean');
    const updates = Object.fromEntries(booleanKeys.filter(key => typeof body[key] === 'boolean').map(key => [key, body[key]]));
    if (/^[A-Z]{3}$/.test(String(body.currency || ''))) updates.currency = body.currency;
    if (!Object.keys(updates).length) return { status: 400, body: { error: 'At least one valid preference is required' } };
    await getDb().collection('users').doc(user.userId).set({ preferences: updates, updated_at: now() }, { merge: true });
    const profile = await userProfile(user.userId);
    return { body: { preferences: { ...defaults, ...(profile?.preferences || {}) } } };
}

function requireAdmin(user) {
    if (!['admin', 'super_admin'].includes(user.role)) {
        const error = new Error('Access denied. Admin privileges required.');
        error.status = 403;
        throw error;
    }
}

async function restrictedCustomerResponse(user, parts) {
    if (user.role !== 'customer' || user.userId === GUEST_ID) return null;
    if (parts[0] === 'chat' || parts[0] === 'notifications') return null;
    const profile = await userProfile(user.userId);
    if (profile?.status === 'suspended' || profile?.transfer_pin_locked || profile?.status === 'restricted') {
        return { status: 403, body: { error: 'Your account is restricted. Contact American Bank United support to appeal. Only an administrator can reactivate your account.', code: 'ACCOUNT_RESTRICTED', support: 'admin-chat.html' } };
    }
    return null;
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

async function getApprovalPolicy() {
    const settings = await getDoc('settings', 'approval-thresholds');
    const values = settings?.values || {};
    return {
        transferThreshold: Number(values.transfer_threshold || 5000),
        withdrawalThreshold: Number(values.withdrawal_threshold || 1000),
        requireAll: values.require_all_approvals === true || values.require_all_approvals === 'true',
        maxPinAttempts: Math.max(3, Math.min(10, Number(values.max_pin_attempts || 5)))
    };
}

function approvalSettingDefaults() {
    return {
        withdrawal_threshold: '1000',
        transfer_threshold: '5000',
        require_all_approvals: 'false',
        max_pin_attempts: '5'
    };
}

async function recordAdminAction(user, actionType, description, metadata = {}) {
    await save('admin_actions', {
        admin_id: user.userId,
        action_type: actionType,
        description,
        metadata,
        created_at: now()
    });
}

async function save(collection, data, id = randomUUID()) {
    const record = { ...data, id, created_at: data.created_at || now(), updated_at: now() };
    await getDb().collection(collection).doc(id).set(record, { merge: true });
    return record;
}

async function ensureGuest() {
    if (Date.now() - guestCheckedAt < 5 * 60 * 1000) return;
    const ref = getDb().collection('users').doc(GUEST_ID);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
        await ref.set({ id: GUEST_ID, email: 'guest@americanbankunited.local', first_name: 'Guest', last_name: 'User', role: 'customer', status: 'active', created_at: now() });
    }
    guestCheckedAt = Date.now();

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
    let snapshot;
    try {
        snapshot = await getDb().collection('users').where('email', '==', String(email || '').toLowerCase()).limit(1).get();
    } catch (error) {
        if (String(error.code) === '8' || String(error.message || '').includes('RESOURCE_EXHAUSTED')) {
            return { status: 503, body: { error: 'Login is temporarily unavailable because the database quota has been reached. Please try again later.' } };
        }
        throw error;
    }
    if (snapshot.empty) return { status: 401, body: { error: 'Invalid email or password' } };
    const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    if (user.status && !['active', 'suspended'].includes(user.status)) return { status: 403, body: { error: 'Account is inactive' } };
    if (!(await bcrypt.compare(password || '', user.password_hash || ''))) return { status: 401, body: { error: 'Invalid email or password' } };
    await getDb().collection('users').doc(user.id).set({ last_login: now() }, { merge: true });
    return { body: { message: 'Login successful', token: makeToken(user), user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role || 'customer' } } };
}

async function accountRoutes(method, parts, user, body, query = {}) {
    if (method === 'GET' && parts[0] === 'lookup') {
        const identifier = String(query.identifier || '').trim();
        const snapshot = await getDb().collection('accounts').where('status', '==', 'active').limit(1000).get();
        const matches = snapshot.docs.filter(doc => accountIdentifierMatches(doc.data(), identifier));
        const accountDoc = matches.length === 1 ? matches[0] : null;
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
        const emailResult = await sendAccountTransactionAlert({ email: profile?.email, phone: profile?.phone, firstName: profile?.first_name || profile?.firstName, direction: 'credit', amount, receiver: { name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), accountNumber: account.account_number, bank: 'American Bank United' }, sender: { name: body.senderName || 'External sender', accountNumber: body.senderAccountNumber, bank: body.senderBank || 'External bank' }, reference: receiptId, description: body.description || `Deposit via ${body.method || 'bank transfer'}`, transferType: 'Deposit', bankCharge: body.bankCharge || body.fee || 0 });
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
    const pinError = await verifyTransferPin(user, body.transferPin);
    if (pinError) return pinError;
    const approvalPolicy = await getApprovalPolicy();
    if (approvalPolicy.requireAll || amount > approvalPolicy.transferThreshold) {
        const pending = await save('transactions', {
            account_id: body.fromAccountId,
            type: 'transfer',
            amount: -amount,
            description: body.description || 'Transfer awaiting admin approval',
            related_account_id: body.toAccountId,
            approval_status: 'pending',
            status: 'pending',
            operation_type: 'internal_transfer',
            operation_data: { fromAccountId: body.fromAccountId, toAccountId: body.toAccountId, amount, description: body.description || 'Transfer' },
            user_id: user.userId
        });
        return { status: 202, body: { message: 'Transfer submitted for admin approval', status: 'pending', transactionId: pending.id } };
    }
    const db = getDb();
    const result = await db.runTransaction(async transaction => {
        const fromRef = db.collection('accounts').doc(body.fromAccountId);
        let fromSnap = await transaction.get(fromRef);
        if (!fromSnap.exists) {
            const sourceCandidates = await db.collection('accounts').where('user_id', '==', user.userId).limit(1000).get();
            const sourceMatches = sourceCandidates.docs.filter(doc => isTransferableAccount(doc.data()) && accountIdentifierMatches(doc.data(), body.fromAccountId));
            if (sourceMatches.length === 1) {
                fromSnap = await transaction.get(sourceMatches[0].ref);
            }
        }
        if (!fromSnap.exists || fromSnap.data().user_id !== user.userId || !isTransferableAccount(fromSnap.data())) {
            const error = new Error('Source account is not active or was not found');
            error.status = 400;
            throw error;
        }

        let toRef = db.collection('accounts').doc(body.toAccountId);
        let toSnap = await transaction.get(toRef);
        if (!toSnap.exists) {
            const candidates = await db.collection('accounts').limit(1000).get();
            const matches = candidates.docs.filter(doc => accountIdentifierMatches(doc.data(), body.toAccountId || body.toAccountNumber || body.toIban));
            const match = matches.length === 1 ? matches[0] : null;
            if (match) {
                toRef = match.ref;
                toSnap = await transaction.get(toRef);
            }
        }
        if (!toSnap.exists || !isTransferableAccount(toSnap.data())) {
            const error = new Error('Destination account is not active or was not found');
            error.status = 400;
            throw error;
        }
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
        transaction.set(db.collection('transactions').doc(withdrawalId), { id: withdrawalId, receipt_id: `RCPT-${Date.now()}-${withdrawalId.slice(0, 8).toUpperCase()}`, receipt_data: body.receiptData || null, account_id: from.id, type: 'transfer', amount: -amount, description: body.description || 'Transfer out', related_account_id: to.id, balance_after: fromBalance, status: 'completed', approval_status: 'approved', created_at: now() });
        transaction.set(db.collection('transactions').doc(depositId), { id: depositId, receipt_id: `RCPT-${Date.now()}-${depositId.slice(0, 8).toUpperCase()}`, account_id: to.id, type: 'deposit', amount, description: body.description || 'Transfer in', related_account_id: from.id, balance_after: toBalance, status: 'completed', approval_status: 'approved', created_at: now() });
        return { withdrawalId, depositId, fromBalance, toBalance, recipientUserId: to.user_id, senderAccountNumber: from.account_number, senderAccountType: from.account_type, recipientAccountNumber: to.account_number, recipientAccountType: to.account_type };
    });
    const recipient = await userProfile(result.recipientUserId);
    const senderProfile = await userProfile(user.userId);
    const [senderEmailResult, recipientEmailResult] = await Promise.all([
        sendAccountTransactionAlert({ email: senderProfile?.email, phone: senderProfile?.phone, firstName: senderProfile?.first_name || senderProfile?.firstName, direction: 'debit', amount, sender: { name: `${senderProfile?.first_name || ''} ${senderProfile?.last_name || ''}`.trim(), accountNumber: result.senderAccountNumber, bank: 'American Bank United' }, receiver: { name: `${recipient?.first_name || ''} ${recipient?.last_name || ''}`.trim(), accountNumber: result.recipientAccountNumber, bank: 'American Bank United' }, transferType: 'ABU account transfer', reference: result.withdrawalId, description: body.description || 'Transfer sent', bankCharge: body.bankCharge || body.fee || 0 }),
        sendAccountTransactionAlert({ email: recipient?.email, phone: recipient?.phone, firstName: recipient?.first_name || recipient?.firstName, direction: 'credit', amount, sender: { name: `${senderProfile?.first_name || ''} ${senderProfile?.last_name || ''}`.trim(), accountNumber: result.senderAccountNumber, bank: 'American Bank United' }, receiver: { name: `${recipient?.first_name || ''} ${recipient?.last_name || ''}`.trim(), accountNumber: result.recipientAccountNumber, bank: 'American Bank United' }, transferType: 'ABU account transfer', reference: result.depositId, description: body.description || 'Transfer received', bankCharge: body.bankCharge || body.fee || 0 })
    ]);
    return { body: { message: 'Transfer completed successfully', status: 'approved', withdrawalId: result.withdrawalId, depositId: result.depositId, newBalance: result.fromBalance, notification: recipientEmailResult, senderEmail: senderEmailResult } };
}

async function notificationRoutes(method, parts, user) {
    if (method !== 'GET' || parts.length !== 0) return { status: 404, body: { error: 'Route not found' } };
    const accounts = await listDocs('accounts', 'user_id', user.userId, null, 1000);
    const profile = user.userId === GUEST_ID ? null : await userProfile(user.userId);
    const preferences = profile?.preferences || {};
    const supportNotifications = [];
    if (user.userId !== GUEST_ID && preferences.supportMessages !== false) {
        const conversation = await getDb().collection('chat_conversations').doc(user.userId).get();
        if (conversation.exists) {
            const messages = await conversation.ref.collection('messages').get();
            supportNotifications.push(...messages.docs.filter(doc => doc.data().sender_role === 'admin').map(doc => ({
                id: `support-${doc.id}`,
                type: 'support_message',
                title: 'New support reply',
                message: doc.data().text || 'You have a new message from support.',
                createdAt: doc.data().created_at
            })));
        }
    }
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
        })),
        ...supportNotifications
    ];
    notifications.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    return { body: notifications.filter(item => {
        if (preferences.transactionAlerts === false && ['transaction', 'account_activity'].includes(item.type)) return false;
        if (preferences.supportMessages === false && item.type === 'support_message') return false;
        return true;
    }).slice(0, 100) };
}

async function chatRoutes(method, parts, user, body, query = {}) {
    const db = getDb();
    const conversationsSnapshot = await db.collection('chat_conversations').where('user_id', '==', user.userId).get();
    const conversations = conversationsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((left, right) => String(right.last_message_at || right.updated_at || '').localeCompare(String(left.last_message_at || left.updated_at || '')));
    const requestedConversationId = String(body.conversationId || body.conversation_id || query.conversationId || '').trim();
    const selectedConversation = conversations.find(item => item.id === requestedConversationId) || conversations[0] || null;
    const conversationRef = selectedConversation ? db.collection('chat_conversations').doc(selectedConversation.id) : null;
    const conversation = conversationRef ? await conversationRef.get() : null;

    async function messagesFor(ref) {
        if (!ref) return [];
        const snapshot = await ref.collection('messages').get();
        return snapshot.docs.map(doc => clean({ id: doc.id, ...doc.data() })).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    }

    if (method === 'POST' && parts[0] === 'start') {
        const inquiry = String(body.inquiry || '').trim();
        const allowedInquiries = ['Account access', 'Transfer issue', 'Deposit or withdrawal', 'Card support', 'Fraud or suspicious activity', 'Other question'];
        if (!allowedInquiries.includes(inquiry)) return { status: 400, body: { error: 'Select a valid inquiry type' } };
        const profile = await userProfile(user.userId);
        const timestamp = now();
        const existing = conversations.find(item => item.inquiry === inquiry && item.status !== 'closed');
        const ref = existing ? db.collection('chat_conversations').doc(existing.id) : db.collection('chat_conversations').doc(randomUUID());
        const data = { id: ref.id, user_id: user.userId, user_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), user_email: profile?.email || '', inquiry, status: 'open', updated_at: timestamp };
        await ref.set(data, { merge: true });
        return { body: { conversation: clean({ ...data, ...(existing || {}) }), conversationId: ref.id, messages: await messagesFor(ref) } };
    }

    if (method === 'GET' && parts.length === 0) {
        const selected = requestedConversationId ? conversations.find(item => item.id === requestedConversationId) : conversations[0];
        const selectedRef = selected ? db.collection('chat_conversations').doc(selected.id) : null;
        return {
            body: {
                conversations: clean(conversations),
                conversation: selected ? clean(selected) : null,
                unreadCount: selected ? Number(selected.customer_unread_count || 0) : 0,
                messages: await messagesFor(selectedRef)
            }
        };
    }

    if (method === 'POST' && parts[0] === 'read') {
        if (conversationRef && conversation?.exists) await conversationRef.set({ customer_unread_count: 0, updated_at: now() }, { merge: true });
        return { body: { success: true } };
    }

    if (method === 'POST' && parts.length === 0) {
        if (!conversationRef || !conversation?.exists) return { status: 400, body: { error: 'Start or select a conversation first' } };
        const text = String(body.text || '').trim();
        let attachment;
        try { attachment = normalizeChatAttachment(body.attachment); } catch (error) { return { status: 400, body: { error: error.message } }; }
        if ((!text && !attachment) || text.length > 2000) return { status: 400, body: { error: 'Add a message or attachment; text must be 2000 characters or fewer' } };
        const profile = await userProfile(user.userId);
        const timestamp = now();
        const message = { id: randomUUID(), conversation_id: conversationRef.id, sender_id: user.userId, sender_role: 'customer', text, attachment, created_at: timestamp };
        await conversationRef.set({ id: conversationRef.id, user_id: user.userId, user_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(), user_email: profile?.email || '', status: 'open', last_message: text || `Attachment: ${attachment.name}`, last_message_at: timestamp, admin_unread_count: Number(conversation.data().admin_unread_count || 0) + 1, updated_at: timestamp }, { merge: true });
        await conversationRef.collection('messages').doc(message.id).set(message);
        return { status: 201, body: { message: clean(message) } };
    }

    if (method === 'DELETE' && parts[0] === 'messages' && parts[1]) {
        if (!conversationRef) return { status: 404, body: { error: 'Message not found' } };
        const messageRef = conversationRef.collection('messages').doc(parts[1]);
        const message = await messageRef.get();
        if (!message.exists || message.data().sender_id !== user.userId) return { status: 404, body: { error: 'Message not found' } };
        await messageRef.delete();
        return { body: { success: true } };
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
    if (method === 'GET' && (parts[0] === 'external' || parts[0] === 'transfers')) {
        const transfers = await listDocs('external_transfers', 'user_id', user.userId);
        return { body: clean(transfers.map(normalizeAdminTransferReceipt)) };
    }
    if (method === 'POST' && ['send-to-bank', 'send-to-user'].includes(parts[0])) {
        const pinError = await verifyTransferPin(user, body.transferPin);
        if (pinError) return pinError;
        const account = await getDoc('accounts', body.fromAccountId);
        const amount = Number(body.amount);
        if (!account || account.user_id !== user.userId) return { status: 404, body: { error: 'Account not found' } };
        if (Number(account.balance) < amount) return { status: 400, body: { error: 'Insufficient funds' } };
        const newBalance = Number((Number(account.balance) - amount).toFixed(2));
        await getDb().runTransaction(async transaction => transaction.update(getDb().collection('accounts').doc(account.id), { balance: newBalance, updated_at: now() }));
        const transferType = parts[0] === 'send-to-user' ? 'p2p' : (body.transferType || 'ach');
        const receiptId = `RCPT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const transfer = await save('external_transfers', { user_id: user.userId, account_id: account.id, transfer_type: transferType, direction: 'outgoing', amount, recipient_name: body.accountHolderName || body.recipientEmail || '', recipient_identifier: body.accountNumber || body.recipientEmail || '', recipient_email: body.recipientEmail || null, recipient_phone: body.recipientPhone || null, bank_name: body.bankName || null, status: 'completed', receipt_id: receiptId, receipt_data: body.receiptData || null, description: body.description || 'External transfer' });
        await save('transactions', { account_id: account.id, type: 'withdrawal', amount: -amount, receipt_id: receiptId, receipt_data: body.receiptData || null, status: 'completed', description: transfer.description, balance_after: newBalance });
        const senderProfile = await userProfile(user.userId);
        const [senderNotification, recipientNotification] = await Promise.all([
            sendAccountTransactionAlert({ email: senderProfile?.email, phone: senderProfile?.phone, firstName: senderProfile?.first_name || senderProfile?.firstName, direction: 'debit', amount, sender: { name: `${senderProfile?.first_name || ''} ${senderProfile?.last_name || ''}`.trim(), accountNumber: account.account_number, bank: 'American Bank United' }, receiver: { name: body.accountHolderName || body.recipientEmail, accountNumber: body.accountNumber, bank: body.bankName || 'External bank' }, reference: receiptId, transferType, description: body.description || 'External transfer sent', bankCharge: body.bankCharge || body.fee || 0 }),
            sendAccountTransactionAlert({ email: body.recipientEmail, phone: body.recipientPhone, firstName: body.accountHolderName, direction: 'credit', sender: { name: `${senderProfile?.first_name || ''} ${senderProfile?.last_name || ''}`.trim(), accountNumber: account.account_number, bank: 'American Bank United' }, receiver: { name: body.accountHolderName || body.recipientEmail, accountNumber: body.accountNumber, bank: body.bankName || 'External bank' }, reference: receiptId, transferType, description: body.description || 'External transfer received', bankCharge: body.bankCharge || body.fee || 0 })
        ]);
        const notification = { sender: senderNotification, recipient: recipientNotification };
        await getDb().collection('external_transfers').doc(transfer.id).set({ notification_status: notification }, { merge: true });
        return { body: { success: true, message: 'Transfer completed successfully', transfer: { id: transfer.id, amount, status: 'completed', newBalance, notification } } };
    }
    return { status: 404, body: { error: 'Route not found' } };
}

async function beneficiaryRoutes(method, parts, user, body) {
    if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in to manage beneficiaries' } };
    const collection = getDb().collection('beneficiaries');
    if (method === 'GET' && parts.length === 0) return { body: clean(await listDocs('beneficiaries', 'user_id', user.userId, 'created_at', 200)) };
    if (method === 'POST' && parts.length === 0) {
        const name = String(body.name || '').trim();
        const accountNumber = String(body.accountNumber || body.account_number || '').trim();
        const bankName = String(body.bankName || body.bank_name || '').trim();
        if (!name || !accountNumber || !bankName) return { status: 400, body: { error: 'Name, account number or IBAN, and bank name are required' } };
        const existing = await collection.where('user_id', '==', user.userId).where('account_number', '==', accountNumber).limit(1).get();
        if (!existing.empty) return { status: 409, body: { error: 'This beneficiary is already saved' } };
        const beneficiary = await save('beneficiaries', { user_id: user.userId, name, account_number: accountNumber, bank_name: bankName, nickname: String(body.nickname || '').trim(), email: String(body.email || '').trim(), phone: String(body.phone || '').trim(), transfer_type: ['abu', 'other_bank', 'international'].includes(body.transferType) ? body.transferType : 'other_bank', country: String(body.country || '').trim(), swift: String(body.swift || '').trim(), created_at: now(), updated_at: now() });
        return { status: 201, body: { beneficiary: clean(beneficiary) } };
    }
    if (parts[0]) {
        const beneficiary = await getDoc('beneficiaries', parts[0]);
        if (!beneficiary || beneficiary.user_id !== user.userId) return { status: 404, body: { error: 'Beneficiary not found' } };
        const ref = collection.doc(parts[0]);
        if (method === 'DELETE') { await ref.delete(); return { body: { success: true } }; }
        if (method === 'PUT') {
            const updates = { name: String(body.name || '').trim(), account_number: String(body.accountNumber || body.account_number || '').trim(), bank_name: String(body.bankName || body.bank_name || '').trim(), nickname: String(body.nickname || '').trim(), email: String(body.email || '').trim(), phone: String(body.phone || '').trim(), transfer_type: ['abu', 'other_bank', 'international'].includes(body.transferType) ? body.transferType : (beneficiary.transfer_type || 'other_bank'), country: String(body.country || '').trim(), swift: String(body.swift || '').trim(), updated_at: now() };
            if (!updates.name || !updates.account_number || !updates.bank_name) return { status: 400, body: { error: 'Name, account number or IBAN, and bank name are required' } };
            await ref.set(updates, { merge: true });
            return { body: { beneficiary: clean({ ...beneficiary, ...updates, id: parts[0] }) } };
        }
    }
    return { status: 404, body: { error: 'Beneficiary route not found' } };
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
    const pinError = await verifyTransferPin(user, body.transferPin);
    if (pinError) return pinError;

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

const ACCOUNT_TIERS = {
    tier1: { label: 'Tier 1 · Essential', documentTypes: ['national_id'], required: ['identity', 'address'], dailyTransferLimit: 5000, transferAccountLimit: 15000, dailyDepositLimit: 50000, depositAccountLimit: 100000 },
    tier2: { label: 'Tier 2 · Plus', documentTypes: ['drivers_license', 'ssn_proof'], required: ['identity', 'address'], dailyTransferLimit: 15000, transferAccountLimit: 100000, dailyDepositLimit: 100000, depositAccountLimit: 1000000 },
    tier3: { label: 'Tier 3 · Premier', documentTypes: ['international_passport'], required: ['identity', 'address'], dailyTransferLimit: null, transferAccountLimit: null, dailyDepositLimit: null, depositAccountLimit: null }
};
const ACCOUNT_TIER_RANK = { tier1: 1, tier2: 2, tier3: 3 };

function validVerificationPath(path, userId) {
    if (typeof path !== 'string') return false;
    if (path.startsWith(`uploads/${userId}/`)) return path.length < 500;
    return /^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=]+$/.test(path) && path.length <= 450000;
}

async function verificationRoutes(method, parts, user, body) {
    if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in to verify your account' } };

    if (method === 'GET' && parts.length === 0) {
        const requests = await listDocs('verification_requests', 'user_id', user.userId, 'created_at', 20);
        return { body: clean(requests) };
    }

    if (method === 'POST' && parts.length === 0) {
        const tier = ACCOUNT_TIERS[body.tier];
        const identityType = String(body.identityType || '');
        const documents = body.documents || {};
        if (!tier || !tier.documentTypes.includes(identityType)) return { status: 400, body: { error: 'Select a valid identity document for this tier' } };
        const currentUser = await userProfile(user.userId);
        if ((ACCOUNT_TIER_RANK[body.tier] || 0) <= (ACCOUNT_TIER_RANK[currentUser?.account_tier] || 0) && currentUser?.verification_status === 'verified') return { status: 400, body: { error: 'Select a tier higher than your current verified tier' } };
        if (!validVerificationPath(documents.identity, user.userId) || !validVerificationPath(documents.address, user.userId)) {
            return { status: 400, body: { error: 'Both identity and residential proof documents are required' } };
        }
        const existing = await listDocs('verification_requests', 'user_id', user.userId, 'created_at', 20);
        if (existing.some(request => request.status === 'pending')) return { status: 409, body: { error: 'A verification request is already under review' } };

        const request = await save('verification_requests', {
            user_id: user.userId,
            tier: body.tier,
            identity_type: identityType,
            documents: { identity: documents.identity, address: documents.address },
            status: 'pending',
            review_eta_hours: 48,
            submitted_at: now()
        });
        return { status: 201, body: { message: 'Documents submitted. Bank verification usually takes up to 48 hours.', request: clean(request) } };
    }
    return { status: 404, body: { error: 'Verification route not found' } };
}

async function adminRoutes(method, parts, user, body, query) {
    requireAdmin(user);

    if (method === 'GET' && parts[0] === 'notifications') {
        const [accounts, transactions, verifications, conversations, transfers] = await Promise.all([
            getDb().collection('accounts').where('approval_status', '==', 'pending').limit(100).get(),
            getDb().collection('transactions').where('approval_status', '==', 'pending').limit(100).get(),
            getDb().collection('verification_requests').where('status', '==', 'pending').limit(100).get(),
            getDb().collection('chat_conversations').get(),
            getDb().collection('admin_transfers').orderBy('created_at', 'desc').limit(25).get()
        ]);
        const notifications = [
            ...accounts.docs.map(doc => ({ id: `account-${doc.id}`, type: 'approval', title: 'Account approval required', message: `New ${doc.data().account_type || 'account'} request is waiting for review.`, href: 'admin-accounts.html', createdAt: doc.data().created_at })),
            ...transactions.docs.map(doc => ({ id: `transaction-${doc.id}`, type: 'approval', title: 'Transaction approval required', message: `${doc.data().description || 'A transaction'} is waiting for review.`, href: 'admin-approvals.html', createdAt: doc.data().created_at })),
            ...verifications.docs.map(doc => ({ id: `verification-${doc.id}`, type: 'approval', title: 'Identity verification required', message: `A ${doc.data().tier || 'tier'} upgrade is waiting for review.`, href: 'admin-approvals.html', createdAt: doc.data().created_at })),
            ...conversations.docs.filter(doc => Number(doc.data().admin_unread_count || 0) > 0).map(doc => ({ id: `chat-${doc.id}`, type: 'chat', title: 'Unread customer message', message: `${doc.data().user_name || 'A customer'} has ${doc.data().admin_unread_count} unread message(s).`, href: 'admin-chat.html', createdAt: doc.data().updated_at || doc.data().last_message_at })),
            ...transfers.docs.map(doc => ({ id: `transfer-${doc.id}`, type: 'activity', title: 'Admin transfer completed', message: `Transfer of $${Number(doc.data().amount || 0).toFixed(2)} sent to ${doc.data().recipient_name || 'an ABU user'}.`, href: 'admin-transactions.html', createdAt: doc.data().created_at }))
        ];
        notifications.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
        return { body: { notifications: clean(notifications.slice(0, 150)) } };
    }

    if (method === 'GET' && parts[0] === 'transfer-recipients') {
        const usersSnapshot = await getDb().collection('users').where('role', '==', 'customer').limit(1000).get();
        const recipients = [];
        for (const userDoc of usersSnapshot.docs) {
            const customer = { id: userDoc.id, ...userDoc.data() };
            const accounts = await listDocs('accounts', 'user_id', customer.id, null, 100);
            recipients.push({
                id: customer.id,
                name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
                email: customer.email || '',
                accounts: accounts.filter(account => account.status === 'active' && String(account.approval_status || 'approved') === 'approved').map(account => ({ id: account.id, accountNumber: account.account_number, iban: account.iban || '', type: account.account_type, balance: Number(account.balance || 0) }))
            });
        }
        return { body: { recipients: recipients.filter(recipient => recipient.accounts.length) } };
    }

    if (method === 'POST' && parts[0] === 'transfers' && parts.length === 1) {
        const amount = Number(body.amount);
        const senderName = String(body.senderName || '').trim();
        const bankName = String(body.bankName || '').trim();
        const requestedAccountId = String(body.accountId || '').trim();
        const recipientName = String(body.recipientName || '').trim();
        const recipientIdentifier = String(body.accountNumber || body.iban || '').trim();
        const transferType = ['other_bank', 'international'].includes(body.transferType) ? body.transferType : 'abu';
        const recipientEmail = String(body.recipientEmail || '').trim();
        const recipientPhone = String(body.recipientPhone || '').trim();
        const description = String(body.description || '').trim() || 'Admin funded transfer';
        if (!senderName || !bankName || !requestedAccountId || !recipientName || !recipientIdentifier || !Number.isFinite(amount) || amount <= 0) {
            return { status: 400, body: { error: 'Sender name, sender bank, recipient name, account number or IBAN, and a valid amount are required' } };
        }

        const accountsSnapshot = await getDb().collection('accounts').limit(1000).get();
        const normalizedRecipient = normalizeName(recipientName);
        const matches = accountsSnapshot.docs.filter(doc => {
            const account = doc.data();
            const identifierMatches = doc.id === requestedAccountId && accountIdentifierMatches(account, recipientIdentifier);
            const ownerName = account.user_id;
            return identifierMatches && ownerName;
        });
        if (matches.length !== 1) return { status: 404, body: { error: 'A unique ABU account could not be found for that account number or IBAN' } };

        const accountRef = matches[0].ref;
        const account = { id: matches[0].id, ...matches[0].data() };
        const recipient = await getDoc('users', account.user_id);
        const actualName = normalizeName(`${recipient?.first_name || ''} ${recipient?.last_name || ''}`);
        if (!recipient || actualName !== normalizedRecipient) return { status: 400, body: { error: 'Recipient name does not match the ABU account holder' } };
        if (String(account.status || '').toLowerCase() !== 'active' || String(account.approval_status || 'approved').toLowerCase() !== 'approved') return { status: 400, body: { error: 'The recipient account is not active' } };

        const isInternal = transferType === 'abu';
        const transferId = randomUUID();
        const transactionId = randomUUID();
        const timestamp = now();
        const receiptId = `RCPT-${Date.now()}-${transactionId.slice(0, 8).toUpperCase()}`;
        const receiptData = {
            type: transferType === 'international' ? 'International Transfer' : isInternal ? 'ABU Account Transfer' : 'External Transfer',
            amount,
            amountSent: amount,
            senderName,
            senderBankName: bankName,
            senderAccountNumber: 'American Bank United admin account',
            senderEmail: '',
            senderPhone: '',
            recipientName,
            to: recipientName,
            recipientBank: 'American Bank United',
            bank: 'American Bank United',
            recipientAccountNumber: recipientIdentifier,
            accountNumber: recipientIdentifier,
            email: recipientEmail,
            phone: recipientPhone,
            swift: body.swift || '',
            country: body.country || '',
            reference: receiptId,
            date: new Date(timestamp).toLocaleString('en-US'),
            description,
            fee: '0.00'
        };
        const result = await getDb().runTransaction(async transaction => {
            const fresh = await transaction.get(accountRef);
            if (!fresh.exists || fresh.data().status !== 'active') throw new Error('The recipient account is not active');
            const newBalance = Number((Number(fresh.data().balance || 0) + amount).toFixed(2));
            transaction.update(accountRef, { balance: newBalance, updated_at: timestamp });
            transaction.set(getDb().collection('transactions').doc(transactionId), {
                id: transactionId, receipt_id: receiptId, account_id: account.id, type: 'deposit', amount, balance_after: newBalance,
                description, bank_name: bankName, source_name: senderName, transfer_id: transferId,
                transfer_type: transferType === 'international' ? 'international_transfer' : isInternal ? 'internal_admin_transfer' : 'other_bank_funds', receipt_data: receiptData, status: 'completed', approval_status: 'approved', created_at: timestamp
            });
            transaction.set(getDb().collection('admin_transfers').doc(transferId), {
                id: transferId, user_id: recipient.id, account_id: account.id, amount, bank_name: bankName,
                sender_name: senderName, recipient_name: recipientName, recipient_identifier: recipientIdentifier, recipient_email: recipientEmail || null, recipient_phone: recipientPhone || null, description,
                transfer_type: transferType === 'international' ? 'international_transfer' : isInternal ? 'internal_admin_transfer' : 'other_bank_funds', status: 'completed', created_by: user.userId, created_at: timestamp
            });
            if (!isInternal) transaction.set(getDb().collection('external_transfers').doc(transferId), {
                id: transferId, receipt_id: receiptId, user_id: recipient.id, account_id: account.id, direction: 'incoming', amount,
                transfer_type: transferType === 'international' ? 'international_transfer' : 'other_bank_funds', bank_name: bankName, sender_name: senderName, recipient_name: recipientName, recipient_email: recipientEmail || null, recipient_phone: recipientPhone || null,
                recipient_identifier: recipientIdentifier, receipt_data: receiptData, description, status: 'completed', created_at: timestamp
            });
            return { newBalance };
        });
        const recipientProfile = await userProfile(recipient.id);
        const creditNotification = await sendAccountTransactionAlert({ email: recipientProfile?.email || recipientEmail, phone: recipientProfile?.phone || recipientPhone, firstName: recipientProfile?.first_name || recipientProfile?.firstName || recipientName, direction: 'credit', amount, sender: { name: senderName, accountNumber: 'American Bank United admin account', bank: bankName }, receiver: { name: recipientName, accountNumber: account.account_number, bank: 'American Bank United' }, reference: receiptId, transferType: transferType === 'international' ? 'International transfer' : isInternal ? 'ABU account transfer' : 'Other-bank transfer', description, bankCharge: receiptData.fee });
        return { status: 201, body: { message: transferType === 'international' ? 'International transfer completed successfully' : isInternal ? 'ABU transfer completed successfully' : 'Other-bank funds credited successfully', transferType, transferId, newBalance: result.newBalance, notification: creditNotification } };
    }

    if (method === 'GET' && parts[0] === 'verification-requests') {
        const requests = await listDocs('verification_requests', 'status', 'pending', 'created_at', 500);
        const withUsers = await Promise.all(requests.map(async request => {
            const customer = await getDoc('users', request.user_id);
            const documents = {};
            for (const [key, path] of Object.entries(request.documents || {})) {
                if (typeof path === 'string' && path.startsWith('data:')) {
                    documents[key] = path;
                    continue;
                }
                try {
                    const [url] = await getBucket().file(path).getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
                    documents[key] = url;
                } catch (error) {
                    documents[key] = null;
                }
            }
            return clean({ ...request, documents, user: customer ? { id: customer.id, first_name: customer.first_name, last_name: customer.last_name, email: customer.email } : null });
        }));
        return { body: { requests: withUsers } };
        return { body: { requests: withUsers } };
    }

    if (method === 'POST' && parts[0] === 'verification-requests' && parts[1] && parts[2] === 'approve') {
        const request = await getDoc('verification_requests', parts[1]);
        if (!request || request.status !== 'pending') return { status: 404, body: { error: 'Pending verification request not found' } };
        const timestamp = now();
        await getDb().collection('verification_requests').doc(request.id).set({ status: 'approved', reviewed_by: user.userId, reviewed_at: timestamp, updated_at: timestamp }, { merge: true });
        await getDb().collection('users').doc(request.user_id).set({ account_tier: request.tier, verification_status: 'verified', verified_at: timestamp, verified_by: user.userId, updated_at: timestamp }, { merge: true });
        return { body: { message: 'Account tier approved successfully' } };
    }

    if (method === 'POST' && parts[0] === 'verification-requests' && parts[1] && parts[2] === 'reject') {
        const request = await getDoc('verification_requests', parts[1]);
        if (!request || request.status !== 'pending') return { status: 404, body: { error: 'Pending verification request not found' } };
        await getDb().collection('verification_requests').doc(request.id).set({ status: 'rejected', rejection_reason: String(body.reason || 'Documents could not be verified'), reviewed_by: user.userId, reviewed_at: now(), updated_at: now() }, { merge: true });
        return { body: { message: 'Verification request rejected' } };
    }

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
            let attachment;
            try { attachment = normalizeChatAttachment(body.attachment); } catch (error) { return { status: 400, body: { error: error.message } }; }
            if ((!text && !attachment) || text.length > 2000) return { status: 400, body: { error: 'Add a message or attachment; text must be 2000 characters or fewer' } };
            const timestamp = now();
            const message = { id: randomUUID(), conversation_id: parts[1], sender_id: user.userId, sender_role: 'admin', text, attachment, created_at: timestamp };
            const current = await conversationRef.get();
            await conversationRef.set({ status: 'open', last_message: text || `Attachment: ${attachment.name}`, last_message_at: timestamp, customer_unread_count: Number(current.data()?.customer_unread_count || 0) + 1, updated_at: timestamp }, { merge: true });
            await conversationRef.collection('messages').doc(message.id).set(message);
            return { status: 201, body: { message: clean(message) } };
        }
        if (method === 'DELETE' && parts[2] === 'messages' && parts[3]) {
            const messageRef = conversationRef.collection('messages').doc(parts[3]);
            if (!(await messageRef.get()).exists) return { status: 404, body: { error: 'Message not found' } };
            await messageRef.delete();
            return { body: { success: true } };
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

    if (method === 'GET' && parts[0] === 'transactions' && parts[1] === 'pending') {
        const snapshot = await getDb().collection('transactions').where('approval_status', '==', 'pending').limit(500).get();
        const transactions = await Promise.all(snapshot.docs.map(async doc => {
            const transaction = { id: doc.id, ...doc.data() };
            const account = await getDoc('accounts', transaction.account_id);
            const customer = account ? await getDoc('users', account.user_id) : null;
            return clean({ ...transaction, account_number: account?.account_number || '', account_type: account?.account_type || '', first_name: customer?.first_name || '', last_name: customer?.last_name || '', email: customer?.email || '' });
        }));
        return { body: { transactions } };
    }

    if (method === 'POST' && parts[0] === 'transactions' && parts[1] && parts[2] === 'approve') {
        const transaction = await getDoc('transactions', parts[1]);
        if (!transaction || transaction.approval_status !== 'pending') return { status: 404, body: { error: 'Pending transaction not found' } };
        if (transaction.operation_type === 'internal_transfer') {
            const operation = transaction.operation_data || {};
            const amount = Number(operation.amount);
            const db = getDb();
            const result = await db.runTransaction(async firestoreTransaction => {
                const fromRef = db.collection('accounts').doc(operation.fromAccountId);
                const toRef = db.collection('accounts').doc(operation.toAccountId);
                const fromSnap = await firestoreTransaction.get(fromRef);
                const toSnap = await firestoreTransaction.get(toRef);
                if (!fromSnap.exists || !toSnap.exists || fromSnap.data().user_id !== transaction.user_id || !isTransferableAccount(fromSnap.data()) || !isTransferableAccount(toSnap.data())) throw new Error('Transfer accounts are no longer available');
                if (Number(fromSnap.data().balance || 0) < amount) throw new Error('Insufficient funds');
                const fromBalance = Number((Number(fromSnap.data().balance || 0) - amount).toFixed(2));
                const toBalance = Number((Number(toSnap.data().balance || 0) + amount).toFixed(2));
                firestoreTransaction.update(fromRef, { balance: fromBalance, updated_at: now() });
                firestoreTransaction.update(toRef, { balance: toBalance, updated_at: now() });
                firestoreTransaction.set(db.collection('transactions').doc(parts[1]), { approval_status: 'approved', status: 'completed', approved_by: user.userId, approved_at: now(), balance_after: fromBalance, updated_at: now() }, { merge: true });
                return { fromBalance, toBalance, fromAccount: { ...fromSnap.data(), id: fromSnap.id }, toAccount: { ...toSnap.data(), id: toSnap.id } };
            });
            const sender = await userProfile(transaction.user_id);
            const recipient = await userProfile(result.toAccount.user_id);
            const [senderEmail, recipientEmail] = await Promise.all([
                sendAccountTransactionAlert({ email: sender?.email, phone: sender?.phone, firstName: sender?.first_name, direction: 'debit', amount, sender: { name: `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim(), accountNumber: result.fromAccount.account_number, bank: 'American Bank United' }, receiver: { name: `${recipient?.first_name || ''} ${recipient?.last_name || ''}`.trim(), accountNumber: result.toAccount.account_number, bank: 'American Bank United' }, reference: transaction.receipt_id || transaction.id, transferType: 'ABU account transfer', description: transaction.description || 'Transfer sent' }),
                sendAccountTransactionAlert({ email: recipient?.email, phone: recipient?.phone, firstName: recipient?.first_name, direction: 'credit', amount, sender: { name: `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim(), accountNumber: result.fromAccount.account_number, bank: 'American Bank United' }, receiver: { name: `${recipient?.first_name || ''} ${recipient?.last_name || ''}`.trim(), accountNumber: result.toAccount.account_number, bank: 'American Bank United' }, reference: transaction.receipt_id || transaction.id, transferType: 'ABU account transfer', description: transaction.description || 'Transfer received' })
            ]);
            return { body: { message: 'Transfer approved successfully', newBalance: result.fromBalance, notifications: { sender: senderEmail, recipient: recipientEmail } } };
        }
        await getDb().collection('transactions').doc(parts[1]).set({ approval_status: 'approved', approved_by: user.userId, approved_at: now(), updated_at: now() }, { merge: true });
        return { body: { message: 'Transaction approved successfully' } };
    }

    if (method === 'POST' && parts[0] === 'transactions' && parts[1] && parts[2] === 'reject') {
        const transaction = await getDoc('transactions', parts[1]);
        if (!transaction || transaction.approval_status !== 'pending') return { status: 404, body: { error: 'Pending transaction not found' } };
        await getDb().collection('transactions').doc(parts[1]).set({ approval_status: 'rejected', rejection_reason: body.reason || 'Rejected by admin', rejected_by: user.userId, rejected_at: now(), updated_at: now() }, { merge: true });
        return { body: { message: 'Transaction rejected successfully' } };
    }

    if (method === 'POST' && parts[0] === 'transactions' && parts[1] && parts[2] === 'notify') {
        const transaction = await getDoc('transactions', parts[1]);
        if (!transaction) return { status: 404, body: { error: 'Transaction not found' } };
        const account = await getDoc('accounts', transaction.account_id);
        const customer = account ? await getDoc('users', account.user_id) : null;
        if (!customer) return { status: 404, body: { error: 'Transaction recipient not found' } };
        const channels = Array.isArray(body.channels) ? body.channels : ['email'];
        const notification = await sendTransferNotifications({
            email: channels.includes('email') ? (body.email || customer.email) : '',
            phone: channels.includes('sms') ? (body.phone || customer.phone) : '',
            recipientName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
            amount: transaction.amount,
            transferType: transaction.transfer_type || 'admin transaction',
            bankName: transaction.bank_name || 'American Bank United',
            accountNumber: account.account_number,
            description: transaction.description || 'Admin transaction'
        });
        return { body: { message: 'Notification request processed', notification } };
    }

    if (method === 'GET' && parts[0] === 'settings' && parts[1] === 'approval-thresholds') {
        const settings = await getDoc('settings', 'approval-thresholds');
        return { body: { settings: Object.entries({ ...approvalSettingDefaults(), ...(settings?.values || {}) }).map(([setting_name, setting_value]) => ({ setting_name, setting_value })) } };
    }

    if (method === 'PUT' && parts[0] === 'settings' && parts[1] === 'approval-thresholds') {
        const requestedSettings = body.settings || body;
        const values = {
            withdrawal_threshold: String(requestedSettings.withdrawal_threshold || 1000),
            transfer_threshold: String(requestedSettings.transfer_threshold || 5000),
            require_all_approvals: String(Boolean(requestedSettings.require_all_approvals)),
            max_pin_attempts: String(Math.max(3, Math.min(10, Number(requestedSettings.max_pin_attempts || 5))))
        };
        await getDb().collection('settings').doc('approval-thresholds').set({ values, updated_at: now(), updated_by: user.userId }, { merge: true });
        await recordAdminAction(user, 'SETTINGS_UPDATED', 'Approval and transfer security settings updated', values);
        return { body: { message: 'Approval settings updated successfully', settings: Object.entries(values).map(([setting_name, setting_value]) => ({ setting_name, setting_value })) } };
    }

    if (method === 'POST' && parts[0] === 'settings' && parts[1] === 'approval-thresholds' && parts[2] === 'reset') {
        const values = approvalSettingDefaults();
        await getDb().collection('settings').doc('approval-thresholds').set({ values, updated_at: now(), updated_by: user.userId }, { merge: true });
        await recordAdminAction(user, 'SETTINGS_RESET', 'Approval and transfer security settings reset to defaults', values);
        return { body: { message: 'Approval settings reset to defaults', settings: Object.entries(values).map(([setting_name, setting_value]) => ({ setting_name, setting_value })) } };
    }

    if (method === 'GET' && parts[0] === 'data-management') {
        const collections = ['users', 'accounts', 'transactions', 'cards', 'notifications', 'chat_conversations', 'admin_actions'];
        const counts = await Promise.all(collections.map(async collection => {
            const snapshot = await getDb().collection(collection).get();
            return [collection, snapshot.size];
        }));
        const settings = await getDoc('settings', 'approval-thresholds');
        return { body: { counts: Object.fromEntries(counts), settingsUpdatedAt: settings?.updated_at || null } };
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
            recentTransactions.push(...tx.map(item => ({ ...normalizeAdminTransferReceipt(item), account_number: account.account_number })));
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

        await getDb().collection('users').doc(userId).set({ status, updated_at: now(), status_reason: reason || null, ...(status === 'active' ? { transfer_pin_locked: false, transfer_pin_failures: 0 } : {}) }, { merge: true });

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
        const db = getDb();
        for (const [collection, field] of [['transactions', 'account_id'], ['cards', 'linked_account_id'], ['external_transfers', 'account_id']]) {
            const related = await db.collection(collection).where(field, '==', accountId).get();
            if (!related.empty) {
                const batch = db.batch();
                related.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
        await db.collection('accounts').doc(accountId).delete();

        return {
            body: {
                message: 'Account rejected and removed successfully',
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
        const accountOwner = await userProfile(account.user_id);
        const transactionId = randomUUID();
        const receiptId = `RCPT-${Date.now()}-${transactionId.slice(0, 8).toUpperCase()}`;
        await getDb().collection('accounts').doc(accountId).set({ balance: balanceAfter, updated_at: timestamp }, { merge: true });
        await save('transactions', {
            id: transactionId,
            account_id: accountId,
            type: 'deposit',
            amount,
            receipt_id: receiptId,
            description: 'Deposit',
            balance_after: balanceAfter,
            approval_status: 'approved',
            transfer_type: 'admin_balance_adjustment',
            receipt_data: { type: 'ABU Account Transfer', amount, amountSent: amount, senderName: 'American Bank United Admin', recipientName: `${accountOwner?.first_name || ''} ${accountOwner?.last_name || ''}`.trim(), recipientBank: 'American Bank United', recipientAccountNumber: account.account_number, senderAccountNumber: 'Admin adjustment', reference: receiptId, date: new Date(timestamp).toLocaleString('en-US'), description: reason, fee: '0.00' },
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
        const limit = Number(reqQuery(query, 'limit', 100)) || 100;
        const snapshot = await getDb().collection('transactions').orderBy('created_at', 'desc').limit(limit).get();
        const transactions = await Promise.all(snapshot.docs.map(async doc => {
            const transaction = { id: doc.id, ...doc.data() };
            const account = await getDoc('accounts', transaction.account_id);
            const customer = account ? await getDoc('users', account.user_id) : null;
            return clean({ ...transaction, account_number: account?.account_number || '', account_type: account?.account_type || '', first_name: customer?.first_name || '', last_name: customer?.last_name || '', email: customer?.email || '' });
        }));
        return { body: { transactions } };
    }

    if (method === 'GET' && parts[0] === 'audit-log') {
        const limit = Number(reqQuery(query, 'limit', 100) || 100);
        const [transferSnapshot, actionSnapshot, securitySnapshot] = await Promise.all([
            getDb().collection('admin_transfers').orderBy('created_at', 'desc').limit(limit).get(),
            getDb().collection('admin_actions').limit(limit).get(),
            getDb().collection('security_audit').orderBy('created_at', 'desc').limit(limit).get()
        ]);
        const transferActions = await Promise.all(transferSnapshot.docs.map(async doc => {
            const item = { id: doc.id, ...doc.data() };
            const admin = await getDoc('users', item.created_by);
            return clean({ id: item.id, action_type: 'ADMIN_TRANSFER', description: `${item.transfer_type || 'Transfer'} of $${Number(item.amount || 0).toFixed(2)} to ${item.recipient_name || 'user'}`, metadata: item, created_at: item.created_at, first_name: admin?.first_name || 'Admin', last_name: admin?.last_name || '', email: admin?.email || '' });
        }));
        const settingsActions = await Promise.all(actionSnapshot.docs.map(async doc => {
            const item = { id: doc.id, ...doc.data() };
            const admin = await getDoc('users', item.admin_id);
            return clean({ id: item.id, action_type: item.action_type, description: item.description, metadata: item.metadata || {}, created_at: item.created_at, first_name: admin?.first_name || 'Admin', last_name: admin?.last_name || '', email: admin?.email || '' });
        }));
        const securityActions = await Promise.all(securitySnapshot.docs.map(async doc => {
            const item = { id: doc.id, ...doc.data() };
            const customer = await getDoc('users', item.user_id);
            return clean({ id: item.id, action_type: item.action_type, description: `${item.purpose || 'Security'} security event`, metadata: item.metadata || {}, created_at: item.created_at, first_name: customer?.first_name || 'Customer', last_name: customer?.last_name || '', email: customer?.email || '' });
        }));
        const actions = [...transferActions, ...settingsActions, ...securityActions]
            .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
            .slice(0, limit);
        return { body: { actions } };
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
        if ((method === 'GET' || method === 'PATCH') && parts[1] === 'profile') {
            const user = await authenticate(req);
            if (method === 'PATCH') {
                if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in before updating your profile' } };
                const firstName = String(body.first_name || '').trim();
                const lastName = String(body.last_name || '').trim();
                const email = String(body.email || '').trim().toLowerCase();
                const phone = String(body.phone || '').trim();
                const avatar = String(body.avatar || '').trim();
                if (!firstName || !lastName || !isValidEmail(email)) return { status: 400, body: { error: 'First name, last name, and a valid email are required' } };
                if (avatar && !/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(avatar) && !/^https?:\/\//i.test(avatar)) {
                    return { status: 400, body: { error: 'Profile picture must be a valid image' } };
                }
                if (avatar.length > 700000) return { status: 400, body: { error: 'Profile picture is too large. Choose a smaller image.' } };
                const existing = await getDb().collection('users').where('email', '==', email).limit(2).get();
                if (existing.docs.some(doc => doc.id !== user.userId)) return { status: 409, body: { error: 'Email is already registered' } };
                await getDb().collection('users').doc(user.userId).set({ first_name: firstName, last_name: lastName, email, phone, ...(avatar ? { avatar } : {}), updated_at: now() }, { merge: true });
            }
            return { body: clean(await userProfile(user.userId)) };
        }
    }

    const user = await authenticate(req);
    await ensureGuest();
    if (parts[0] === 'security') return securityCodeRoutes(method, parts.slice(1), user, body);
    const restrictedResponse = await restrictedCustomerResponse(user, parts);
    if (restrictedResponse) return restrictedResponse;
    if (parts[0] === 'accounts') return accountRoutes(method, parts.slice(1), user, body, req.query || {});
    if (parts[0] === 'transfer-pin') return transferPinRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'preferences' && parts.length === 1) return preferenceRoutes(method, user, body);
    if (parts[0] === 'chat') return chatRoutes(method, parts.slice(1), user, body, req.query || {});
    if (parts[0] === 'transactions') return transactionRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'notifications') return notificationRoutes(method, parts.slice(1), user);
    if (parts[0] === 'cards') return cardRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'bills') return billRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'external-transfers') return externalRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'beneficiaries') return beneficiaryRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'withdrawals') return withdrawalRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'verification') return verificationRoutes(method, parts.slice(1), user, body);
    if (parts[0] === 'admin') return adminRoutes(method, parts.slice(1), user, body, req.query || {});
    if (parts[0] === 'storage' && method === 'POST' && parts[1] === 'upload-url') {
        if (user.userId === GUEST_ID) return { status: 401, body: { error: 'Please sign in before uploading documents' } };
        if (!String(body.contentType || '').match(/^(image\/(jpeg|png|webp)|application\/pdf)$/)) return { status: 400, body: { error: 'Only PDF, JPG, PNG, and WEBP files are accepted' } };
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
        const quotaExceeded = String(error.code) === '8' || String(error.message || '').includes('RESOURCE_EXHAUSTED');
        res.status(quotaExceeded ? 503 : (error.status || 500)).json({
            error: quotaExceeded ? 'This service is temporarily unavailable because the database quota has been reached. Please try again later.' : (error.message || 'Internal server error')
        });
    }
};
