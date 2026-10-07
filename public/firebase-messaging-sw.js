/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Configuration from firebase-applet-config.json
firebase.initializeApp({
  apiKey: "AIzaSyBpB9wzgOywv6u9BMbhjiUQPilotMHSOWA",
  authDomain: "famous-palace-vlzxc.firebaseapp.com",
  projectId: "famous-palace-vlzxc",
  storageBucket: "famous-palace-vlzxc.firebasestorage.app",
  messagingSenderId: "71178543687",
  appId: "1:71178543687:web:963f2508d03fa0ed340762"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'تنبيه جديد';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || '/logo.png',
    badge: '/logo.png',
    tag: payload.notification?.tag || payload.data?.tag || undefined,
    renotify: !payload.notification?.tag,
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/',
      ...payload.data
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Deep link navigation on notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(self.registration.scope) && 'navigate' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
