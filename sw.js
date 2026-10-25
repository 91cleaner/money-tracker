/* 홈 화면 앱용 서비스 워커. 늘 인터넷에서 새로 받고(network-first), 끊겼을 때만 마지막으로 받은 것을 보여 준다.
   자료가 매시간 바뀌는 사이트라 캐시를 먼저 쓰지 않는다. */
const C = 'mt-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return; // 지도 타일·통계 등 바깥 요청은 건드리지 않음
  e.respondWith(fetch(r).then((res) => {
    if (res.ok && (r.mode === 'navigate' || /\.(css|js|json|png|svg)(\?|$)/.test(r.url))) { const cp = res.clone(); caches.open(C).then((c) => c.put(r, cp)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then((m) => m || (r.mode === 'navigate' ? caches.match('./') : undefined)).then((m) => m || new Response('인터넷 연결을 확인해 주세요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))));
});
