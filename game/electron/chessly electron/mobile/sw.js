const CACHE_NAME = 'chessly-mobile-v1';
const ASSETS = [
  '/mobile/',
  '/mobile/index.html',
  '/mobile/style.css',
  '/mobile/app.js',
  '/mobile/manifest.json',
  '/assets/icon/chessly_mobile.png'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  // Network-first strategy for socket.io, cache-first for static assets
  if (e.request.url.includes('socket.io')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});