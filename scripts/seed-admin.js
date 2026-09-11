const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let credential;
if (serviceAccountPath) {
    const absolutePath = path.resolve(serviceAccountPath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`Firebase service-account file not found: ${absolutePath}`);
        process.exit(1);
    }
    credential = admin.credential.cert(require(absolutePath));
} else {
    const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
    const missing = required.filter(name => !process.env[name] || process.env[name] === '[SENSITIVE]');
    if (missing.length) {
        console.error(`Missing usable Firebase credentials: ${missing.join(', ')}. Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service-account JSON file.`);
        process.exit(1);
    }

    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
    }
    if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
        privateKey = privateKey.slice(1, -1).trim();
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
        console.error('FIREBASE_PRIVATE_KEY must contain a complete PEM private key. Check .env.local formatting.');
        process.exit(1);
    }

    credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey
    });
}

const email = (process.env.ADMIN_EMAIL || 'admin@americanbankunited.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin@123';
const app = admin.initializeApp({
    credential
});

async function seedAdmin() {
    const db = admin.firestore();
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    const passwordHash = await bcrypt.hash(password, 10);
    const data = {
        email,
        first_name: process.env.ADMIN_FIRST_NAME || 'Admin',
        last_name: process.env.ADMIN_LAST_NAME || 'User',
        password_hash: passwordHash,
        role: 'admin',
        status: 'active',
        updated_at: new Date().toISOString()
    };

    if (snapshot.empty) {
        const ref = db.collection('users').doc();
        await ref.set({ id: ref.id, ...data, created_at: new Date().toISOString() });
        console.log(`Created Firestore admin: ${email}`);
    } else {
        const ref = snapshot.docs[0].ref;
        await ref.set(data, { merge: true });
        console.log(`Updated Firestore admin: ${email}`);
    }
}

seedAdmin()
    .catch(error => {
        console.error('Failed to seed Firestore admin:', error.message);
        process.exitCode = 1;
    })
    .finally(() => admin.app().delete());
