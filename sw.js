const CACHE = 'geography-quiz-app-v17-400-questions';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './questions.js',
  './app.js',
  './manifest.webmanifest',
  './data/questions-terrain.js',
  './data/questions-climate.js',
  './data/questions-agriculture.js',
  './data/questions-industry.js',
  './data/questions-resources-energy.js',
  './data/questions-population-city.js',
  './data/questions-transport-trade.js',
  './data/questions-state-ethnicity-religion.js',
  './data/questions-regional.js',
  './data/questions-map.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then(res => res || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const url = new URL(request.url);
        if (request.method === 'GET' && url.origin === self.location.origin && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
