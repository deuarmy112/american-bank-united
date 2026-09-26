importScripts('/js/firebase-web-config.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp(self.ABU_FIREBASE_WEB_CONFIG);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    const title = payload.data?.title || 'American Bank United';
    const options = {
        body: payload.data?.body || 'A new account update is available. Sign in to review it.',
        icon: '/assets/abu-logo.png',
        data: { url: payload.data?.url || '/notifications.html' }
    };
    return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || '/notifications.html', self.location.origin).href;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        const existing = clientList.find(client => client.url.startsWith(self.location.origin));
        if (existing) {
            existing.navigate(targetUrl);
            return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
    }));
});