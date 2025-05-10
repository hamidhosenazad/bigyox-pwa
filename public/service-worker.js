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

// Store Twilio connection status
let twilioConnected = false;
let lastTwilioCheck = Date.now();
let twilioUserId = null;

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
self.addEventListener('notificationclick', async function(event) {
  event.notification.close();
  
  // Get all windows with our PWA open
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });
  
  // If we have a window already open, focus it
  for (const windowClient of windowClients) {
    if (windowClient.url.includes(BASE_PATH)) {
      await windowClient.focus();
      return;
    }
  }
  
  // If no window is open, open a new one
  await clients.openWindow(`${BASE_PATH}/${event.notification.data.userId || ''}`);
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

// Function to check Twilio connection status
const checkTwilioConnection = async () => {
  console.log('Checking Twilio connection status in service worker');
  
  // If it's been more than 5 minutes since the last check and we think we're connected,
  // request a connection check from any active clients
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() - lastTwilioCheck > fiveMinutes) {
    console.log('It has been more than 5 minutes since the last Twilio check');
    
    // Try to find an active client to check the connection
    const clients = await self.clients.matchAll({ type: 'window' });
    if (clients.length > 0) {
      console.log('Found active client, requesting Twilio connection check');
      clients[0].postMessage({
        type: 'CHECK_TWILIO_CONNECTION',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('No active clients found, will try to wake up the app');
      
      // If no active clients and we have a user ID, try to show a notification to wake up the app
      if (twilioUserId) {
        self.registration.showNotification('Reconnecting to Twilio', {
          body: 'Tap to ensure you receive incoming calls',
          icon: `${BASE_PATH}/icons/icon-192x192.png`,
          badge: `${BASE_PATH}/icons/icon-72x72.png`,
          tag: 'reconnect-notification',
          data: { userId: twilioUserId }
        });
      }
    }
    
    // Update the last check time
    lastTwilioCheck = Date.now();
  }
};

// Function to perform background sync operations
async function doBackgroundSync() {
  console.log('Performing background sync...');
  
  try {
    // Check Twilio connection status
    await checkTwilioConnection();
    
    // Send heartbeat to server
    const response = await fetch('https://getcredentials-3757.twil.io/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'heartbeat',
        twilioConnected: twilioConnected,
        userId: twilioUserId
      }),
    });
    
    if (!response.ok) {
      throw new Error('Heartbeat failed');
    }
    
    // If we're not connected to Twilio, try to wake up the app
    if (!twilioConnected && twilioUserId) {
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length === 0) {
        await self.registration.showNotification('Service Disconnected', {
          body: 'Tap to reconnect to the calling service',
          icon: `${BASE_PATH}/icons/icon-192x192.png`,
          badge: `${BASE_PATH}/icons/icon-72x72.png`,
          tag: 'reconnect-notification',
          data: { userId: twilioUserId }
        });
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle incoming call notifications
self.addEventListener('message', async (event) => {
  if (event.data.type === 'INCOMING_CALL') {
    console.log('Incoming call notification received in service worker');
    
    // Store the user ID for later use
    twilioUserId = event.data.userId;
    
    // Show notification for incoming call
    await self.registration.showNotification('Incoming Call', {
      body: 'Tap to answer the call',
      icon: `${BASE_PATH}/icons/icon-192x192.png`,
      badge: `${BASE_PATH}/icons/icon-72x72.png`,
      vibrate: [200, 100, 200, 100, 200],
      tag: 'call-notification',
      renotify: true,
      requireInteraction: true,
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' }
      ],
      data: { userId: twilioUserId }
    });
  } else if (event.data.type === 'WAKE_UP') {
    // Update Twilio connection status
    twilioConnected = event.data.twilioConnected;
    lastTwilioCheck = Date.now();
    
    // If we're not connected, try to wake up the app
    if (!twilioConnected && twilioUserId) {
      const clients = await self.clients.matchAll({ type: 'window' });
      if (clients.length === 0) {
        // No active clients, show notification to wake up app
        await self.registration.showNotification('Reconnecting to Service', {
          body: 'Tap to ensure you receive incoming calls',
          icon: `${BASE_PATH}/icons/icon-192x192.png`,
          badge: `${BASE_PATH}/icons/icon-72x72.png`,
          tag: 'reconnect-notification',
          data: { userId: twilioUserId }
        });
      }
    }
  }
});
