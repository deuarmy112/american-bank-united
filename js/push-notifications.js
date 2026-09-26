(function() {
    const TOKEN_KEY = 'abu_fcm_token';
    let messagingPromise;

    function isBrowserSupported() {
        return window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator;
    }

    function isConfigured() {
        const config = window.ABU_FIREBASE_WEB_CONFIG || {};
        const required = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
        return required.every(key => {
            const value = String(config[key] || '');
            return value && !value.startsWith('REPLACE_');
        }) && Boolean(window.ABU_FIREBASE_VAPID_KEY && !window.ABU_FIREBASE_VAPID_KEY.startsWith('REPLACE_'));
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Unable to load Firebase messaging.'));
            document.head.appendChild(script);
        });
    }

    function getMessaging() {
        if (!messagingPromise) {
            messagingPromise = (async () => {
                if (!isConfigured()) throw new Error('Firebase web messaging has not been configured yet.');
                if (!window.firebase) {
                    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
                    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
                }
                if (!firebase.apps.length) firebase.initializeApp(window.ABU_FIREBASE_WEB_CONFIG);
                return firebase.messaging();
            })().catch(error => {
                messagingPromise = null;
                throw error;
            });
        }
        return messagingPromise;
    }

    async function enable() {
        if (!isBrowserSupported()) throw new Error('Browser push is unavailable here. Use a supported browser over HTTPS.');
        if (!isConfigured()) throw new Error('Firebase web messaging has not been configured yet.');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Allow notifications in your browser to enable account alerts.');

        const messaging = await getMessaging();
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const token = await messaging.getToken({
            vapidKey: window.ABU_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration
        });
        if (!token) throw new Error('Firebase did not return a browser notification token.');

        try {
            await apiClient.post('/push-subscriptions', { token });
            localStorage.setItem(TOKEN_KEY, token);
        } catch (error) {
            await messaging.deleteToken().catch(() => {});
            throw error;
        }
        return true;
    }

    async function disable() {
        const token = localStorage.getItem(TOKEN_KEY) || '';
        await apiClient.request('/push-subscriptions', {
            method: 'DELETE',
            body: JSON.stringify(token ? { token } : {})
        });
        if (token && isConfigured()) {
            try {
                const messaging = await getMessaging();
                await messaging.deleteToken();
            } catch (error) {
                console.warn('Could not remove the local Firebase token:', error);
            }
        }
        localStorage.removeItem(TOKEN_KEY);
        return true;
    }

    function isEnabledOnThisBrowser() {
        return isBrowserSupported() && Notification.permission === 'granted' && Boolean(localStorage.getItem(TOKEN_KEY));
    }

    window.pushNotifications = { isBrowserSupported, isConfigured, isEnabledOnThisBrowser, enable, disable };

    if (isEnabledOnThisBrowser()) {
        getMessaging().then(messaging => {
            messaging.onMessage(payload => {
                const data = payload.data || {};
                new Notification(data.title || 'American Bank United', {
                    body: data.body || 'A new account update is available. Sign in to review it.',
                    icon: '/assets/abu-logo.png'
                });
            });
        }).catch(error => console.warn('Foreground push setup failed:', error));
    }
})();