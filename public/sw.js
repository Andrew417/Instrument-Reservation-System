// Service Worker for St. Mark Instrument Reservation Web Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: "كنيسة مارمرقس",
        body: event.data.text(),
      };
    }
  }

  const title = data.title || "حجز آلات الكنيسة";
  const options = {
    body: data.body || "",
    icon: data.icon || "/logo.png",
    badge: data.badge || "/logo.png",
    tag: data.tag || undefined,
    renotify: data.renotify !== undefined ? data.renotify : true,
    data: data.data || {},
    vibrate: [100, 50, 100],
    dir: "auto",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Look for an existing open window on the app
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && targetUrl) {
              client.navigate(targetUrl);
            } else if (client.postMessage) {
              client.postMessage({
                type: "NOTIFICATION_CLICKED",
                payload: event.notification.data,
              });
            }
            return;
          }
        }
        // If no client open, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(
        event.oldSubscription?.options || {
          userVisibleOnly: true,
        },
      )
      .then((newSubscription) => {
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: newSubscription,
          }),
        });
      })
      .catch((err) => {
        console.warn("[SW] pushsubscriptionchange re-subscription failed:", err);
      }),
  );
});
