/* Offline app shell. Exercise animations and local OCR files are cached as used. */
const CACHE_PREFIX = 'gym-stone-';
const SHELL_CACHE = CACHE_PREFIX + 'shell-v47-gym-floor';
const MEDIA_CACHE = CACHE_PREFIX + 'media-v27-motion-art';
const SHELL = [
  "./machine-guide.html",
  "./machine-guide.css?v=1",
  "./machine-guide.js?v=1",
  "./gym-floor-links.js?v=1",
  "./gym-floor-stations.json",
  "./machine-photo-references.json",
  "./gym-floor-reference-sources.json",
  "./assets/machine-references/pendulum-squat.webp",
  "./assets/machine-references/stationary-bike.webp",
  "./assets/machine-references/standing-hip-abduction.webp",
  "./assets/machine-references/decline-chest-press.webp",
  "./assets/machine-references/incline-machine-fly.webp",
  "./assets/machine-references/smith-machine.webp",
  "./assets/machine-references/viking-press.webp",
  "./assets/machine-references/power-rack.webp",
  "./assets/machine-references/french-press-machine.webp",
  "./assets/machine-references/abdominal-bench.webp",
  "./assets/machine-references/glute-kickback-machine.webp",
  "./assets/machine-references/t-bar-row.webp",
  "./assets/machine-references/back-extension-bench.webp",
  "./assets/machine-references/chest-press.webp",
  "./assets/machine-references/rear-delt-machine.webp",
  "./assets/machine-references/lateral-raise.webp",
  "./assets/machine-references/incline-chest-press.webp",
  "./assets/machine-references/shoulder-press.webp",
  "./assets/machine-references/standing-leg-curl.webp",
  "./assets/machine-references/prone-leg-curl.webp",
  "./assets/machine-references/leg-extension.webp",
  "./assets/machine-references/hip-abduction.webp",
  "./assets/machine-references/hip-adduction.webp",
  "./assets/machine-references/hip-thrust.webp",
  "./assets/machine-references/leg-press.webp",
  "./assets/machine-references/belt-squat.webp",
  "./assets/machine-references/hack-squat.webp",
  "./assets/machine-references/dip-machine.webp",
  "./assets/machine-references/standing-calf-raise.webp",
  "./assets/machine-references/seated-calf-raise.webp",
  "./assets/machine-references/pullover.webp",
  "./assets/machine-references/chin-up-station.webp",
  "./assets/machine-references/assisted-pull-up.webp",
  "./assets/machine-references/dumbbells.webp",
  "./assets/machine-references/barbell.webp",
  "./assets/machine-references/ez-bar.webp",
  "./assets/machine-references/incline-bench.webp",
  "./assets/machine-references/preacher-bench.webp",
  "./assets/machine-references/exercise-bench.webp",
  "./assets/machine-references/preacher-curl-machine.webp",
  "./assets/machine-references/lat-pulldown.webp",
  "./assets/machine-references/pec-fly.webp",
  "./assets/machine-references/strength-row-machine.webp",
  "./assets/machine-references/pulley-row.webp",
  "./assets/machine-references/wide-pulldown.webp",
  "./assets/machine-references/treadmill.webp",
  "./assets/machine-references/elliptical.webp",
  "./assets/machine-references/stair-climber.webp",
  "./assets/machine-references/v-squat.png",
  "./assets/machine-references/standing-chest-press.jpg",
  "./assets/machine-references/standing-hip-thrust.webp",
  "./assets/machine-references/weights.webp",
  "./assets/machine-references/dual-smith.jpg",
  "./assets/machine-references/rowing-ergometer.png",
  "./assets/machine-references/air-bike.jpg",
  "./assets/gym-floor/gym-floor-pendulum-squat.svg",
  "./assets/gym-floor/gym-floor-v-squat.svg",
  "./assets/gym-floor/gym-floor-standing-hip-thrust.svg",
  "./assets/gym-floor/gym-floor-standing-machine-hip-abduction.svg",
  "./assets/gym-floor/gym-floor-stationary-cycling.svg",
  "./assets/gym-floor/gym-floor-decline-machine-chest-press.svg",
  "./assets/gym-floor/gym-floor-standing-machine-chest-press.svg",
  "./assets/gym-floor/gym-floor-incline-machine-chest-fly.svg",
  "./assets/gym-floor/gym-floor-smith-machine-bench-press.svg",
  "./assets/gym-floor/gym-floor-incline-smith-machine-bench-press.svg",
  "./assets/gym-floor/gym-floor-smith-machine-shoulder-press.svg",
  "./assets/gym-floor/gym-floor-smith-machine-row.svg",
  "./assets/gym-floor/gym-floor-close-grip-smith-machine-bench-press.svg",
  "./assets/gym-floor/gym-floor-rack-pull.svg",
  "./assets/gym-floor/gym-floor-neutral-grip-dumbbell-bench-press.svg",
  "./assets/gym-floor/gym-floor-underhand-barbell-row.svg",
  "./assets/gym-floor/gym-floor-two-arm-bent-over-dumbbell-row.svg",
  "./assets/gym-floor/gym-floor-dumbbell-grip-hold.svg",
  "./assets/gym-floor/gym-floor-suitcase-hold.svg",
  "./assets/gym-floor/gym-floor-treadmill-walk.svg",
  "./assets/gym-floor/gym-floor-treadmill-run.svg",
  "./assets/gym-floor/gym-floor-dumbbell-russian-twist.svg",
  './burpee-motion-manifest.json',
  './assets/burpee-motion/male-exp-burpee-poster.webp',
  './assets/burpee-motion/male-exp-burpee-atlas.webp',
  './assets/burpee-motion/female-exp-burpee-poster.webp',
  './assets/burpee-motion/female-exp-burpee-atlas.webp',
  './kettlebell-motion-manifest.json',
  './assets/kettlebell-motion/male-kettlebell-russian-twist-animated.webp',
  './assets/kettlebell-motion/male-kettlebell-russian-twist-poster.webp',
  './assets/kettlebell-motion/male-kettlebell-russian-twist-atlas.webp',
  './assets/kettlebell-motion/female-kettlebell-russian-twist-animated.webp',
  './assets/kettlebell-motion/female-kettlebell-russian-twist-poster.webp',
  './assets/kettlebell-motion/female-kettlebell-russian-twist-atlas.webp',
  './assets/kettlebell-motion/male-kettlebell-sit-up-animated.webp',
  './assets/kettlebell-motion/male-kettlebell-sit-up-poster.webp',
  './assets/kettlebell-motion/male-kettlebell-sit-up-atlas.webp',
  './assets/kettlebell-motion/female-kettlebell-sit-up-animated.webp',
  './assets/kettlebell-motion/female-kettlebell-sit-up-poster.webp',
  './assets/kettlebell-motion/female-kettlebell-sit-up-atlas.webp',
  './assets/kettlebell-motion/male-kettlebell-halo-animated.webp',
  './assets/kettlebell-motion/male-kettlebell-halo-poster.webp',
  './assets/kettlebell-motion/male-kettlebell-halo-atlas.webp',
  './assets/kettlebell-motion/female-kettlebell-halo-animated.webp',
  './assets/kettlebell-motion/female-kettlebell-halo-poster.webp',
  './assets/kettlebell-motion/female-kettlebell-halo-atlas.webp',
  './title-progression-data.js?v=2', './title-progression.js?v=3', './title-progression.css?v=2',
  './daily-quest-data.js?v=1', './daily-quests.js?v=1', './daily-quests.css?v=1',
  "./assets/postpartum/postpartum-comfortable-rib-breathing.svg",
  "./assets/postpartum/postpartum-pelvic-floor-release.svg",
  "./assets/postpartum/postpartum-gentle-ankle-movement.svg",
  "./assets/postpartum/postpartum-short-easy-walk.svg",
  "./assets/postpartum/postpartum-gentle-pelvic-floor-lift-release.svg",
  "./assets/postpartum/postpartum-side-lying-core-connection.svg",
  './button-system.css?v=1', './button-system.js?v=2', './navigation-options.html', './navigation-options.css', './navigation-options.js',
  './clean-animation.js?v=19', './clean-animation.css?v=19', './motion-framing.json',
  './exercise-history.css?v=1', './exercise-history.js?v=1', './workout-recommendations.css?v=3', './workout-recommendations-data.js?v=3', './workout-recommendations.js?v=4', './', './index.html', './app.js?v=26-gym-floor', './style.css?v=5', './calendar-theme.css', './nutrition.css?v=2', './nutrition.js?v=2', './nutrition-tools.js?v=1', './food-worker.js', './machine-data.js?v=3', './machine-label.js?v=2', './machine-references.js?v=1', './machine-photo.js?v=7', './machine-photo.css?v=6', './machine-worker.js?v=2', './food-library.json', './navigation.css?v=1', './navigation.js?v=5', './stretch-library.js?v=5', './postpartum-library.js?v=1', './postpartum-library.css?v=1', './stretch-library.css?v=2', './expanded-library.js?v=4', './expanded-library.css?v=2',
  './screenshot-import.css?v=2', './screenshot-parser.js', './screenshot-store.js?v=4',
  './screenshot-import.js?v=3', './workout-tracking.js?v=5', './set-entries.css?v=1', './set-entry-fields.js?v=1', './progress-data.js?v=3', './progress.js?v=2', './progress.css?v=1', './exercises.json', './exercise-muscles.js?v=4', './muscle-map.js?v=1', './muscle-map.css?v=1', './qr-code.js',
  './player-profile.js?v=3', './player-profile.css?v=5', './profile-data.js', './cloud-config.js', './cloud-account.js?v=3', './cloud-calendar.js?v=3', './assets/characters/male-avatar.png', './assets/characters/female-avatar.png', './assets/characters/male-character.png', './assets/characters/female-character.png',
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
