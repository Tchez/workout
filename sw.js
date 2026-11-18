/* Bump the release when any app-shell file changes. */
const RELEASE = '2026-11-18-v2';
const ROOT = new URL('./', self.location.href);
const PREFIX = 'workout:' + encodeURIComponent(ROOT.pathname) + ':';
const CACHE = PREFIX + RELEASE;
const SHELL = ['index.html', 'app.css', 'app.js', 'state.js', 'workout.json', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'].map(path => new URL(path, ROOT).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(new URL('index.html', ROOT).href) || fetch(request);
    })());
  } else if (SHELL.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(request) || fetch(request);
    })());
  }
});
