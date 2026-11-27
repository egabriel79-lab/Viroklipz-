/* global firebase, importScripts, clients */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDcg6DhxS0YF6aPsniGGGN4rYKFsQDwg2w',
  authDomain: 'nixi-18175.firebaseapp.com',
  projectId: 'nixi-18175',
  storageBucket: 'nixi-18175.firebasestorage.app',
  messagingSenderId: '29678232559',
  appId: '1:29678232559:web:b385c3491e30609ca74c1a',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || 'Viroklipz';
  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    'Tienes nueva actividad en Viroklipz.';
  const targetUrl = payload?.data?.url || '/';
  const tag = payload?.data?.type ? `viroklipz-${payload.data.type}` : 'viroklipz-push';

  return self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag,
    data: {
      ...(payload?.data || {}),
      url: targetUrl,
    },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = typeof notifData.url === 'string' && notifData.url ? notifData.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'VIROKLIPZ_NOTIFICATION_CLICK',
            url: targetUrl,
            data: notifData,
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
