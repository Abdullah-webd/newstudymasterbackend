import admin from 'firebase-admin';

let firebaseReady = false;

const getServiceAccount = () => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (err) {
            console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
            return null;
        }
    }

    if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    ) {
        return {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        };
    }

    return null;
};

export const initializeFirebaseAdmin = () => {
    if (admin.apps.length > 0) {
        firebaseReady = true;
        return admin.app();
    }

    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
        console.warn('Firebase Admin disabled: missing FIREBASE service account env vars.');
        firebaseReady = false;
        return null;
    }

    try {
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        firebaseReady = true;
        return app;
    } catch (err) {
        firebaseReady = false;
        console.error('Failed to initialize Firebase Admin:', err.message);
        return null;
    }
};

export const getMessagingClient = () => {
    if (!firebaseReady && admin.apps.length === 0) {
        initializeFirebaseAdmin();
    }

    if (admin.apps.length === 0) {
        return null;
    }

    return admin.messaging();
};

