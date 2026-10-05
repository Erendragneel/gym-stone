/* Offline app shell. Exercise animations and local OCR files are cached as used. */
const CACHE_PREFIX = 'gym-stone-';
const SHELL_CACHE = CACHE_PREFIX + 'shell-v6-app-identity';
const MEDIA_CACHE = CACHE_PREFIX + 'media-v1';
const SHELL = [
  './', './index.html', './app.js?v=4', './style.css?v=3', './calendar-theme.css',
  './screenshot-import.css?v=2', './screenshot-parser.js', './screenshot-store.js',
  './screenshot-import.js?v=2', './exercises.json', './qr-code.js',
  './share-install.js', './share-install.css?v=2', './manifest.webmanifest?v=4',
  './icons/gym-stone-v3-32.png', './icons/gym-stone-v3-48.png',
  './icons/gym-stone-v3-180.png', './icons/gym-stone-v3-192.png', './icons/gym-stone-v3-512.png'
];
const shellPaths = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== MEDIA_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url), scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || request.headers.has('range')) return;
  if (request.mode === 'navigate' || shellPaths.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try { const response = await fetch(request); if (response.ok) await cache.put(request, response.clone()); return response; }
      catch { return await cache.match(request) || (request.mode === 'navigate' ? await cache.match('./index.html') : null) || Response.error(); }
    })());
  } else if (/^(assets|icons|vendor\/ocr)\//.test(url.pathname.slice(scope.pathname.length))) {
    event.respondWith((async () => {
      const cache = await caches.open(MEDIA_CACHE), hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.status === 200) {
        try { await cache.put(request, response.clone()); const keys = await cache.keys(); if (keys.length > 170) await cache.delete(keys[0]); } catch {}
      }
      return response;
    })());
  }
});
