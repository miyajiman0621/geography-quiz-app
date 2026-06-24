const CACHE = 'geography-quiz-app-v10-quality-pass';
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
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(res => res || fetch(event.request))));

self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
