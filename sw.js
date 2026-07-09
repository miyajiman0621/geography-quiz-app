const CACHE = 'geography-quiz-app-v34-log-endpoint';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=34',
  './questions.js',
  './app.js?v=34',
  './manifest.webmanifest',
  './data/questions-terrain.js?v=34',
  './data/questions-terrain-practical2.js?v=34',
  './data/questions-climate.js?v=34',
  './data/questions-agriculture.js?v=34',
  './data/questions-industry.js?v=34',
  './data/questions-resources-energy.js?v=34',
  './data/questions-population-city.js?v=34',
  './data/questions-transport-trade.js?v=34',
  './data/questions-state-ethnicity-religion.js?v=34',
  './data/questions-regional.js?v=34',
  './data/questions-regional-intermediate.js?v=34',
  './data/questions-map.js?v=34',
  './data/questions-human-intermediate.js?v=34',
  './data/questions-human-advanced.js?v=34'
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
