const CACHE_NAME = 'alumni-cache-v4';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/main.js',
    '/manifest.json',
    '/portal.html'
];

// Install Event
self.addEventListener('install', event => {
    self.skipWaiting(); // Force the waiting service worker to become the active service worker
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate Event
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => {
                        if (cache !== CACHE_NAME) {
                            console.log('Clearing old cache:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            }),
            self.clients.claim() // Take control of all pages immediately
        ])
    );
});

// Fetch Event - Network First Strategy
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If network request is successful, clone it and save to cache
                if (event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // If network fails, try to serve from cache
                return caches.match(event.request);
            })
    );
});
