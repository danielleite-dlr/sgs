// Service worker do Gestor Beauty (fase 8). Só push e clique na notificação: SEM cache e SEM
// handler de fetch (D-03, fora do escopo o modo offline).
// Cópia de apps/frontend/src/infrastructure/native/push-route.ts e packages/shared/src/push.ts;
// o teste service-worker.test.ts confere que as três regex são iguais.
const AGENDA_ROUTE_RE = /^\/agenda(\?[A-Za-z0-9=&._~%-]*)?$/;
const DEFAULT_ROUTE = '/agenda';
const DEFAULT_TITLE = 'Gestor Beauty';

function isAllowedPushRoute(r) {
  return (
    typeof r === 'string' &&
    r.length <= 300 &&
    !r.includes('..') &&
    !r.startsWith('//') &&
    AGENDA_ROUTE_RE.test(r)
  );
}

function safeRoute(r) {
  return isAllowedPushRoute(r) ? r : DEFAULT_ROUTE;
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    p = {};
  }
  if (!p || typeof p !== 'object') p = {};
  const data = p.data && typeof p.data === 'object' ? p.data : {};
  const title = typeof p.title === 'string' && p.title ? p.title : DEFAULT_TITLE;
  const options = {
    body: typeof p.body === 'string' ? p.body : '',
    icon: '/icons/icon-192.png',
    data: { route: safeRoute(data.route) },
  };
  if (typeof data.appointmentId === 'string' && data.appointmentId) {
    options.tag = 'appt-' + data.appointmentId;
  } else if (typeof data.groupId === 'string' && data.groupId) {
    options.tag = 'grupo-' + data.groupId;
  }
  // Todo push termina em notificação (iOS revoga a assinatura de push silencioso).
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const n = event.notification;
  const route = safeRoute(n && n.data ? n.data.route : undefined);
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (win) {
        await win.focus();
        win.postMessage({ type: 'sgs-open-route', route });
        return;
      }
      await self.clients.openWindow(route);
    })(),
  );
});
