self.addEventListener('push', (event) => {
  if (!event.data) return;
  let notification;
  try {
    notification = event.data.json();
  } catch {
    notification = { title: 'CARE Accommodation', body: event.data.text() };
  }

  event.waitUntil(self.registration.showNotification(notification.title || 'CARE Accommodation', {
    body: notification.body || 'Your booking status has been updated.',
    icon: '/assets/care-logo.png',
    data: { url: notification.url || '/guest/index.html' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/guest/index.html', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
