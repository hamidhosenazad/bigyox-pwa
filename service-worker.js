const CACHE_NAME = 'twilio-pwa-v1';
const BASE_PATH = '/bigyox-pwa';
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/static/js/main.chunk.js`,
  `${BASE_PATH}/static/js/bundle.js`,
  `${BASE_PATH}/static/js/vendors~main.chunk.js`,
  'https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.ogg',
  'https://actions.google.com/sounds/v1/alarms/phone_alerts_and_rings.mp3'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Handle push notifications
self.addEventListener('push', function(event) {
  const data = event.data.json();
  
  const options = {
    body: data.body || 'Incoming call...',
    icon: `${BASE_PATH}/icons/icon-192x192.png`,
    badge: `${BASE_PATH}/icons/icon-72x72.png`,
    vibrate: [100, 50, 100],
    tag: 'call-notification',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'answer', title: 'Answer' },
      { action: 'decline', title: 'Decline' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Incoming Call', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'answer') {
    // Open the app and answer the call
    event.waitUntil(
      clients.openWindow(`${BASE_PATH}/${event.notification.data.userId}`)
    );
  }
});

// Cache and return requests
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://actions.google.com/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a stream and can only be consumed once
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response because it's a stream and can only be consumed once
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 