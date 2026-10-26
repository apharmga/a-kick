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
