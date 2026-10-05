const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/Elijio Villa jr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

// Uses a fresh headless browser and temporary loopback server; never changes installed apps.
// Language Miner's manifest is read from its live site and served unchanged on the same origin.
(async () => {
  const liveManifestResponse = await fetch('https://erendragneel.github.io/language-miner/manifest.webmanifest');
  assert.equal(liveManifestResponse.status, 200);
  const languageManifest = await liveManifestResponse.text();
  const languageHtml = '<!doctype html><html><head><title>Language Miner isolation fixture</title><link rel="manifest" href="manifest.webmanifest"></head><body>Language Miner isolation fixture</body></html>';
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp' };
  let languageProbeRequests = 0;
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/language-miner/manifest.webmanifest') {
      response.writeHead(200, { 'Content-Type': mime['.webmanifest'] }); return response.end(languageManifest);
    }
    if (pathname === '/language-miner/' || pathname === '/language-miner/index.html') {
      response.writeHead(200, { 'Content-Type': mime['.html'] }); return response.end(languageHtml);
    }
    if (pathname === '/language-miner/isolation-probe') {
      languageProbeRequests++; response.writeHead(200, { 'Content-Type': 'text/plain' }); return response.end('Language Miner network response');
    }
    if (!pathname.startsWith('/gym-stone/')) { response.writeHead(404); return response.end('Not found'); }
    const relative = pathname.slice('/gym-stone/'.length) || 'index.html';
    const target = path.resolve(__dirname, relative.endsWith('/') ? relative + 'index.html' : relative);
    if (!target.startsWith(__dirname + path.sep)) { response.writeHead(403); return response.end(); }
    try {
      const content = await fs.readFile(target);
      response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(content);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    const languagePage = await context.newPage();
    await languagePage.goto(origin + '/language-miner/');
    const languageCdp = await context.newCDPSession(languagePage);
    const lmComputed = await languageCdp.send('Page.getAppManifest');
    const lmAppId = await languageCdp.send('Page.getAppId');
    assert.equal(lmComputed.manifest.id, origin + '/');
    assert.equal(lmComputed.manifest.startUrl, origin + '/language-miner/?source=installed-app');
    assert.equal(lmComputed.manifest.scope, origin + '/language-miner/');
    await languagePage.evaluate(async () => {
      localStorage.setItem('jm_profile_separation_sentinel', JSON.stringify({ language: 'ja', progress: 42 }));
      localStorage.setItem('gym-stone-v1', '{}');
      const lmCache = await caches.open('language-miner-separation-sentinel');
      await lmCache.put('/language-miner/index.html', new Response('Language Miner cache sentinel'));
      await caches.open('gym-stone-shell-obsolete-verification');
      async function seedDatabase(name, stores, store, value) {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(name, 1);
          request.onupgradeneeded = () => stores.forEach(key => request.result.createObjectStore(key, { keyPath: 'id' }));
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value);
          tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error);
        }); db.close();
      }
      await seedDatabase('language-miner-update-guardian', ['snapshots'], 'snapshots', { id: 'separation-sentinel', value: 'Language Miner database sentinel' });
      await seedDatabase('gym-stone-records', ['screenshots', 'state'], 'screenshots', { id: 'separation-sentinel', value: 'Gym Stone screenshot sentinel' });
    });

    const gymPage = await context.newPage();
    const pageErrors = [];
    gymPage.on('pageerror', error => pageErrors.push(error.message));
    await gymPage.goto(origin + '/gym-stone/');
    await gymPage.waitForURL(origin + '/gym-stone/dist/');
    await gymPage.waitForFunction(() => document.querySelectorAll('.exercise-card').length === 149);
    await gymPage.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const gymCdp = await context.newCDPSession(gymPage);
    const gymComputed = await gymCdp.send('Page.getAppManifest');
    const gymAppId = await gymCdp.send('Page.getAppId');
    assert.equal(gymComputed.manifest.id, origin + '/gym-stone/');
    assert.equal(gymComputed.manifest.startUrl, origin + '/gym-stone/dist/');
    assert.equal(gymComputed.manifest.scope, origin + '/gym-stone/dist/');
    assert.notEqual(gymComputed.manifest.id, lmComputed.manifest.id);
    if (lmAppId.appId && gymAppId.appId) assert.notEqual(gymAppId.appId, lmAppId.appId);
    const isolation = await gymPage.evaluate(async () => {
      async function readDatabase(name, store) {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const result = await new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).get('separation-sentinel'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        db.close(); return result.value;
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        scopes: registrations.map(registration => registration.scope),
        cacheNames: await caches.keys(),
        lmCache: await (await (await caches.open('language-miner-separation-sentinel')).match('/language-miner/index.html')).text(),
        lmStorage: JSON.parse(localStorage.getItem('jm_profile_separation_sentinel')),
        gymStorage: localStorage.getItem('gym-stone-v1'),
        lmDatabase: await readDatabase('language-miner-update-guardian', 'snapshots'),
        gymDatabase: await readDatabase('gym-stone-records', 'screenshots'),
        languageProbe: await (await fetch('/language-miner/isolation-probe')).text()
      };
    });
    assert.deepEqual(isolation.scopes, [origin + '/gym-stone/dist/']);
    assert.equal(await languagePage.evaluate(() => navigator.serviceWorker.controller), null);
    assert(isolation.cacheNames.includes('gym-stone-shell-v6-app-identity'));
    assert(!isolation.cacheNames.includes('gym-stone-shell-obsolete-verification'));
    assert.equal(isolation.lmCache, 'Language Miner cache sentinel');
    assert.deepEqual(isolation.lmStorage, { language: 'ja', progress: 42 });
    assert.equal(isolation.gymStorage, '{}');
    assert.equal(isolation.lmDatabase, 'Language Miner database sentinel');
    assert.equal(isolation.gymDatabase, 'Gym Stone screenshot sentinel');
    assert.equal(isolation.languageProbe, 'Language Miner network response');
    assert.equal(languageProbeRequests, 1);
    await context.setOffline(true);
    assert.equal(await gymPage.evaluate(async () => { try { await fetch('/language-miner/isolation-probe'); return 'intercepted'; } catch { return 'network-failed'; } }), 'network-failed');
    await gymPage.reload();
    await gymPage.waitForFunction(() => document.querySelectorAll('.exercise-card').length === 149);
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ result: 'PASS', gym: { manifestId: gymComputed.manifest.id, ...gymAppId }, languageMiner: { manifestId: lmComputed.manifest.id, ...lmAppId }, serviceWorkerScope: isolation.scopes[0], checks: ['distinct Chromium-computed identities', 'correct start URLs and scopes', '149 exercises load online and offline', 'Gym activation preserves Language Miner cache and both games storage', 'Gym service worker cannot handle Language Miner requests'] }, null, 2));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
