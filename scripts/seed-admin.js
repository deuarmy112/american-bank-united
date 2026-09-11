const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');

const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
    console.error(`Missing Firebase environment variables: ${missing.join(', ')}`);
    process.exit(1);
}
if (process.env.FIREBASE_PRIVATE_KEY === '[SENSITIVE]') {
    console.error('FIREBASE_PRIVATE_KEY was redacted by Vercel. Add the real Firebase service-account private key to .env.local before running npm run seed-admin.');
    process.exit(1);
}

const email = (process.env.ADMIN_EMAIL || 'admin@americanbankunited.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin@123';
const app = admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
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
