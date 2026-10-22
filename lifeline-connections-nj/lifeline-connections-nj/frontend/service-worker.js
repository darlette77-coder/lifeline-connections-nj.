// Lifeline Connections NJ — service worker
// Strategy: cache the app shell on install; for API calls, try the network
// first and fall back to the last cached response if offline. This keeps
// crisis info and the last-searched zip's resources available with no
// connection, which matters most exactly when things go wrong.

const CACHE_NAME = 'lifeline-shell-v2';
const API_CACHE_NAME = 'lifeline-api-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/assets/logo-full.webp',
  '/assets/icon-mark.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first, cache the successful response for offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
