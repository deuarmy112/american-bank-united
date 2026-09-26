(function () {
    let authPromise;
    let confirmationResult;
    let recaptchaVerifier;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Unable to load Firebase phone verification.'));
            document.head.appendChild(script);
        });
    }

    function isConfigured() {
        const config = window.ABU_FIREBASE_WEB_CONFIG || {};
        return ['apiKey', 'authDomain', 'projectId', 'appId'].every(key => {
            const value = String(config[key] || '');
            return value && !value.startsWith('REPLACE_');
        });
    }

    async function getAuth() {
        if (!authPromise) {
            authPromise = (async () => {
                if (!isConfigured()) throw new Error('Firebase web app settings are not configured.');
                if (!window.firebase) await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
                if (!window.firebase.auth) await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js');
                if (!firebase.apps.length) firebase.initializeApp(window.ABU_FIREBASE_WEB_CONFIG);
                return firebase.auth();
            })().catch(error => {
                authPromise = null;
                throw error;
            });
        }
        return authPromise;
    }

    async function sendCode(phone, recaptchaContainer) {
        const normalizedPhone = String(phone || '').trim().replace(/[()\s.-]/g, '');
        if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) throw new Error('Enter the phone number in international format, such as +12025550123.');
        const auth = await getAuth();
        await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
        if (recaptchaVerifier) recaptchaVerifier.clear();
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier(recaptchaContainer, { size: 'normal' });
        try {
            confirmationResult = await auth.signInWithPhoneNumber(normalizedPhone, recaptchaVerifier);
            return normalizedPhone;
        } catch (error) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
            throw error;
        }
    }

    async function confirmCode(code) {
        if (!confirmationResult) throw new Error('Request a verification code first.');
        const auth = await getAuth();
        const result = await confirmationResult.confirm(String(code || '').trim());
        const verification = { phoneNumber: result.user.phoneNumber, idToken: await result.user.getIdToken(true) };
        await auth.signOut();
        confirmationResult = null;
        if (recaptchaVerifier) recaptchaVerifier.clear();
        recaptchaVerifier = null;
        return verification;
    }

    window.firebasePhoneAuth = { sendCode, confirmCode };
})();