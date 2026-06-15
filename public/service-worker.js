const CACHE_NAME = 'worksync-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap'
];

// Install Service Worker and cache core static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Purging stale cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept requests and serve offline resources
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (such as API POSTs or debug tracking requests)
  if (request.method !== 'GET') {
    return;
  }

  // Handle cross-origin CDN requests for script dependencies (like face-api)
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((networkResponse) => {
            // Cache valid network responses
            if (networkResponse.status === 200) {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, cacheCopy);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback for failed external request
            return new Response('Offline: Resource not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
    );
    return;
  }

  // Network-First for main page / navigation (ensure updates, fallback to cache)
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cacheCopy);
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Cache-First / Stale-While-Revalidate for standard assets (CSS, JS, images)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (Stale-While-Revalidate style)
        fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse);
            });
          }
        }).catch(() => { /* ignore background update errors when offline */ });
        
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cacheCopy);
          });
        }
        return networkResponse;
      });
    })
  );
});
