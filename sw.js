// A-Worthy Adventure's service worker: makes the game installable and lets it
// open without a connection once it has been played.
//  - Code and pages (index.html, src/, styles/, the manifest): network first, so
//    every deploy is picked up at once (mixing old and new modules breaks the
//    game); the cached copy is only used when offline.
//  - Art, sounds and fonts (assets/): cache first, refreshed in the background,
//    since they rarely change and are most of the download.
// Only this site's own GET requests are handled; saves live in localStorage
// and are never touched here.
const CACHE = 'awa-v1';
const ART_CACHE = 'awa-artwork-2';
const CORE = ['./', 'index.html', 'styles/main.css', 'styles/title.css', 'styles/story.css', 'styles/heritage.css',
  'src/main.js', 'manifest.webmanifest', 'assets/logo.svg', 'assets/logo-mark.svg', 'assets/fonts/nunito-latin-wght-normal.woff2',
  'assets/title/transit-road-evening.webp', 'assets/education-gold-nib.webp',
  'assets/maps/singapore-atlas.webp', 'assets/maps/singapore-atlas-relief.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('awa-') && k !== CACHE && k !== ART_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (path.startsWith('api/')) return;   // accounts and cloud saves: always live, never cached
  const put = (res, name = CACHE) => { if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(name).then((c) => c.put(req, copy)); } return res; };
  if (path.startsWith('assets/')) {
    // Cache first; refresh in the background.
    // Use fresh artwork at the existing URLs after the outline removal. The
    // earlier cache still supplies a picture if the first fetch is offline.
    const revisedArt = /^assets\/(?:icons\/|creatures\/|cursor\/|fx\/|world\/|title\/mascot-sit\.webp$)/.test(path);
    const cached = revisedArt ? caches.match(req, { cacheName: ART_CACHE }) : caches.match(req);
    const monsterRevision = url.searchParams.has('v')
      && /^assets\/creatures\/(?:species\/.+\.webp|bosses\/.+\.webp|(?:crab|fowl|serpent|spider)\.png)$/.test(path);
    e.respondWith(cached.then((hit) => {
      // A player may go offline before the updated picture has been fetched.
      const net = fetch(req, revisedArt && !hit ? { cache: 'reload' } : undefined)
        .then((res) => put(res, revisedArt ? ART_CACHE : CACHE))
        .catch(async () => hit
          || (monsterRevision && await caches.match(req, { cacheName: ART_CACHE, ignoreSearch: true }))
          || (revisedArt ? caches.match(req, { cacheName: CACHE, ignoreSearch: monsterRevision }) : undefined));
      return hit || net;
    }));
    return;
  }
  // Network first; fall back to the cache (and to the game's page for navigations).
  e.respondWith(fetch(req).then(put).catch(() =>
    caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))
      .then((res) => res || Response.error())));
});
