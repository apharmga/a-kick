// A-KICK 서비스워커: 항상 최신 파일을 먼저 받고, 인터넷이 끊겼을 때만 저장본을 씀
const CACHE = 'akick-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // 파이어베이스 등 외부 요청은 건드리지 않음
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

/* 푸시 알림 받기 (서버 발송은 앱 출시 때 켬 · functions/index.js) */
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { notification: { title: 'A-KICK', body: e.data ? e.data.text() : '' } }; }
  const n = d.notification || d, data = d.data || {};
  e.waitUntil(self.registration.showNotification(n.title || 'A-KICK', { body: n.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: data.tag || undefined, data: { url: data.url || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => x.url.startsWith(self.registration.scope)); if (w) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
