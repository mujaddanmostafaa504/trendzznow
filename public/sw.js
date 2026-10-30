/* Trendzznow service worker: app-like loading, offline fallback, push notifications. */
const VERSION = '__VERSION__';
const STATIC = 'tn-static-' + VERSION;
const PAGES = 'tn-pages';
const STATIC_RE = /^\/(css|js|fonts|img|demo|uploads)\//;

const OFFLINE_HTML = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f7f5fc;color:#1f1b5c;text-align:center;padding:24px}button{margin-top:16px;padding:12px 24px;border:0;border-radius:99px;background:#d6155b;color:#fff;font-size:16px}</style></head>
<body><div><h1>ইন্টারনেট নেই</h1><p>সংযোগ ফিরলে আবার চেষ্টা করুন।<br>No internet connection. Please try again.</p><button onclick="location.reload()">আবার চেষ্টা করুন / Retry</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('tn-static-') && k !== STATIC).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    );
    return;
  }

  if (STATIC_RE.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (err) {
    d = { title: 'Trendzznow', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Trendzznow', {
      body: d.body || '',
      icon: d.icon || '/img/icon-192.png',
      badge: '/img/icon-192.png',
      image: d.image || undefined,
      tag: d.tag || undefined,
      data: { url: d.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || '/', location.origin).href;
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === location.origin && 'focus' in c) {
          await c.focus();
          if ('navigate' in c) return c.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    })()
  );
});
