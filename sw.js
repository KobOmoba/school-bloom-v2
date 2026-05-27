const CACHE = 'school-bloom-v2-cache-v1';
const ASSETS = ['./index.html', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Don't intercept Firebase requests
  if (e.request.url.includes('firestore.googleapis.com') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('gstatic.com')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const rc = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, rc)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request))
  );
});
