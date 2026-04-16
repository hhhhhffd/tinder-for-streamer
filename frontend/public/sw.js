/**
 * StreamMatch — Service Worker for Push Notifications.
 *
 * Receives push events from the Web Push protocol and displays
 * browser notifications. Handles notification clicks to open
 * the appropriate page in the app.
 */

/* eslint-disable no-restricted-globals */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: "StreamMatch",
      body: event.data.text(),
      url: "/",
    };
  }

  const title = data.title || "StreamMatch";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/badge-72.png",
    data: { url: data.url || "/" },
    tag: data.tag || "streammatch-notification",
    renotify: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        /* If the app is already open, focus it and navigate */
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        /* Otherwise open a new window */
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
