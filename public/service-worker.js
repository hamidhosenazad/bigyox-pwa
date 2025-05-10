const CACHE_NAME = 'twilio-pwa-v2';
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

// Background sync tag
const BACKGROUND_SYNC_TAG = 'twilio-sync';
// Periodic sync tag
const PERIODIC_SYNC_TAG = 'twilio-periodic-sync';

// Install a service worker
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  // Skip waiting forces the waiting service worker to become the active service worker
  self.skipWaiting();
  
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
  console.log('Push notification received');
  
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      body: event.data ? event.data.text() : 'Incoming call...'
    };
  }
  
  const options = {
    body: data.body || 'Incoming call...',
    icon: `${BASE_PATH}/icons/icon-192x192.png`,
    badge: `${BASE_PATH}/icons/icon-72x72.png`,
    vibrate: [100, 50, 100],
    tag: 'call-notification',
    renotify: true,
    requireInteraction: true,
    data: data.data || {},
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
  console.log('Service Worker activating...');
  
  // Claim control immediately, rather than waiting for reload
  event.waitUntil(self.clients.claim());
  
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Register for periodic sync if supported
  if ('periodicSync' in self.registration) {
    event.waitUntil(registerPeriodicSync());
  }
});

// Register for periodic background sync
async function registerPeriodicSync() {
  try {
    // Check if periodic background sync is supported
    if ('periodicSync' in self.registration) {
      // Get permission status
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync',
      });
      
      if (status.state === 'granted') {
        // Register periodic sync with minimum interval of 15 minutes
        await self.registration.periodicSync.register(PERIODIC_SYNC_TAG, {
          minInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
        });
        console.log('Periodic background sync registered');
      }
    }
  } catch (error) {
    console.error('Error registering periodic background sync:', error);
  }
}

// Handle periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === PERIODIC_SYNC_TAG) {
    console.log('Periodic background sync event triggered');
    event.waitUntil(doBackgroundSync());
  }
});

// Handle background sync
self.addEventListener('sync', event => {
  console.log('Background sync event triggered:', event.tag);
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(doBackgroundSync());
  }
});

// Function to perform background sync operations
async function doBackgroundSync() {
  console.log('Performing background sync...');
  
  try {
    // Keep service worker alive by sending a heartbeat to the server
    // This is a placeholder - replace with actual API call to your backend
    const response = await fetch('https://getcredentials-3757.twil.io/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'heartbeat'
      }),
    });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    console.log('Background sync successful:', data);
    
    // If there are any pending notifications from the server, show them
    if (data && data.notifications && data.notifications.length > 0) {
      for (const notification of data.notifications) {
        await self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: `${BASE_PATH}/icons/icon-192x192.png`,
          badge: `${BASE_PATH}/icons/icon-72x72.png`,
          data: notification.data || {}
        });
      }
    }
    
    return data;
  } catch (error) {
    console.error('Background sync failed:', error);
    // Retry by throwing an error - the browser will reschedule the sync
    throw error;
  }
}

// Handle messages from the client
self.addEventListener('message', event => {
  console.log('Message received in service worker:', event.data);
  
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    // Register for background sync
    if ('sync' in self.registration) {
      self.registration.sync.register(BACKGROUND_SYNC_TAG)
        .then(() => {
          console.log('Background sync registered');
          // Respond to the client
          if (event.source) {
            event.source.postMessage({
              type: 'SYNC_REGISTERED',
              success: true
            });
          }
        })
        .catch(error => {
          console.error('Background sync registration failed:', error);
          // Respond to the client
          if (event.source) {
            event.source.postMessage({
              type: 'SYNC_REGISTERED',
              success: false,
              error: error.message
            });
          }
        });
    }
  } else if (event.data && event.data.type === 'WAKE_UP') {
    // This message is just to wake up the service worker
    console.log('Service worker woken up');
    if (event.source) {
      event.source.postMessage({
        type: 'WAKE_UP_RESPONSE',
        timestamp: new Date().toISOString()
      });
    }
  }
});
