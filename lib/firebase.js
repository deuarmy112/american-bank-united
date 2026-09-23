const admin = require('firebase-admin');

let app;

function getFirebaseApp() {
    if (app) return app;

    const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? admin.credential.applicationDefault()
        : process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
            ? admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
            : null;

    if (!credential) {
        throw new Error('Missing Firebase server environment variables');
    }

    app = admin.initializeApp({
        credential,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });

    return app;
}

function getDb() {
    return getFirebaseApp() && admin.firestore();
}

function getBucket() {
    return getFirebaseApp() && admin.storage().bucket();
}

module.exports = { admin, getDb, getBucket };
