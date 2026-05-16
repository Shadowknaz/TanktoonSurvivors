const CORE_CACHE_NAME = 'tankini-core-v1';
const ASSETS_CACHE_NAME = 'tankini-assets-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const expectedCaches = [CORE_CACHE_NAME, ASSETS_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(key => !expectedCaches.includes(key)).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Runtime caching for textures and sounds
  const isAsset = url.pathname.startsWith('/textures/') || 
                  url.pathname.startsWith('/sounds/') || 
                  url.pathname.startsWith('/audio/');

  if (isAsset) {
    event.respondWith(
      caches.open(ASSETS_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for other requests
  event.respondWith(
    caches.open(CORE_CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          const isGet = event.request.method === 'GET';
          const isSuccess = networkResponse.status === 200;
          // Avoid caching source files and hot-updates in dev mode
          const isSource = url.pathname.startsWith('/src/') || 
                           url.pathname.includes('@vite') || 
                           url.pathname.includes('hot-update');

          if (isGet && isSuccess && !isSource) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchedResponse;
      });
    })
  );
});

