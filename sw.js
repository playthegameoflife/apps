const CACHE = 'phg-shell-v21';
const SHELL = ['/', '/index.html', '/generate.js', '/prompt-templates.js', '/style.css', '/site.css', '/shell.css', '/redesign.css?v=18', '/shell.js', '/site.js', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API calls: network-first, no cache
  if (url.hostname === 'api-clyep56cdq-uc.a.run.app') {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Same-origin pages, scripts and styles: network-first, so a deploy is
  // picked up on the next load. The cache is only the offline fallback.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) {
      const clone = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone));
    }
    return res;
  }).catch(() => caches.match(e.request).then((cached) => cached || caches.match('/index.html'))));
});
