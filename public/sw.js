/* Only static offline assets are cached. Account pages, API responses, financial
   inputs and calculator rules are never cached by this worker. Bump the version
   whenever the offline document changes. New versions activate on next launch. */
const CACHE = 'mbc-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE])));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('mbc-offline-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(async () => {
    const fallback = await caches.match(OFFLINE);
    return fallback || new Response('You are offline. Reconnect and try again.', {status:503,headers:{'Content-Type':'text/plain'}});
  }));
});
