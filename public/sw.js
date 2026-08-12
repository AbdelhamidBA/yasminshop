// Minimal Web Push service worker for staff order alerts (Phase 5 Task 5).
// Served statically at /sw.js and registered by
// src/components/admin/push-toggle.tsx. Its only jobs are: show a notification
// when a push arrives, and route a click to the order URL. It caches nothing.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = {};
  }
  const title = data.title || 'Nouvelle commande';
  const body = typeof data.body === 'string' ? data.body : '';
  const url = typeof data.url === 'string' ? data.url : '/admin/orders';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: {url},
      // A stable tag + renotify collapses a burst of order alerts into one
      // updating notification instead of an ever-growing stack.
      tag: 'new-order',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = typeof data.url === 'string' ? data.url : '/admin/orders';

  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((clientList) => {
      // Reuse an already-open admin tab when possible; otherwise open a new one.
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focused) => {
            if (focused && typeof focused.navigate === 'function') {
              return focused.navigate(url).catch(() => undefined);
            }
            return undefined;
          });
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
