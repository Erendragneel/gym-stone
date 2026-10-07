/* Offline app shell. Exercise animations and local OCR files are cached as used. */
const CACHE_PREFIX = 'gym-stone-';
const SHELL_CACHE = CACHE_PREFIX + 'shell-v18-nutrition-larger-previews';
const MEDIA_CACHE = CACHE_PREFIX + 'media-v6-expansion';
const SHELL = [
  './', './index.html', './app.js?v=13', './style.css?v=4', './calendar-theme.css', './nutrition.css?v=1', './nutrition.js?v=1', './navigation.css?v=1', './navigation.js?v=2', './stretch-library.js?v=3', './stretch-library.css?v=2', './expanded-library.js?v=1', './expanded-library.css?v=2',
  './screenshot-import.css?v=2', './screenshot-parser.js', './screenshot-store.js?v=4',
  './screenshot-import.js?v=3', './workout-tracking.js', './exercises.json', './exercise-muscles.js?v=1', './muscle-map.js?v=1', './muscle-map.css?v=1', './qr-code.js',
  './player-profile.js?v=3', './player-profile.css?v=4', './profile-data.js', './cloud-config.js', './cloud-account.js?v=2', './cloud-calendar.js', './assets/characters/male-avatar.png', './assets/characters/female-avatar.png', './assets/characters/male-character.png', './assets/characters/female-character.png',
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
        try { await cache.put(request, response.clone()); const keys = await cache.keys(); if (keys.length > 900) await cache.delete(keys[0]); } catch {}
      }
      return response;
    })());
  }
});
