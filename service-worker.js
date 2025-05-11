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

// Add a persistent wake lock
let wakeLock = null;

// Function to acquire wake lock
async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock acquired in service worker');
      
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released in service worker');
        // Try to reacquire
        setTimeout(acquireWakeLock, 1000);
      });
    }
  } catch (err) {
    console.error('Wake Lock error:', err);
  }
}

// Function to keep service alive
async function keepAlive() {
  try {
    // Try to acquire wake lock
    await acquireWakeLock();
    
    // Send heartbeat more frequently (every 5 seconds)
    const response = await fetch('https://getcredentials-3757.twil.io/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'keepalive',
        twilioConnected: twilioConnected,
        userId: twilioUserId,
        isServiceWorker: true
      })
    });

    if (!response.ok) {
      throw new Error('Keepalive failed');
    }

    const data = await response.json();
    
    // If we need to reconnect, notify all clients
    if (data.shouldReconnect) {
      const clients = await self.clients.matchAll({ 
        type: 'window',
        includeUncontrolled: true 
      });
      
      clients.forEach(client => {
        client.postMessage({
          type: 'CHECK_TWILIO_CONNECTION',
          timestamp: new Date().toISOString(),
          shouldReconnect: true
        });
      });
    }

    // If no active clients and we're not connected, try to wake up
    const clients = await self.clients.matchAll({ type: 'window' });
    if (clients.length === 0 && !twilioConnected && twilioUserId) {
      // Show a notification to get user attention
      await self.registration.showNotification('Connection Lost', {
        body: 'Tap to restore connection',
        icon: `${BASE_PATH}/icons/icon-192x192.png`,
        badge: `${BASE_PATH}/icons/icon-72x72.png`,
        tag: 'reconnect-notification',
        renotify: true,
        requireInteraction: true,
        data: { userId: twilioUserId }
      });

      // Try to wake up the app
      await self.clients.openWindow(`${BASE_PATH}/${twilioUserId}`);
    }
  } catch (error) {
    console.error('Keepalive error:', error);
  } finally {
    // Schedule next keepalive
    setTimeout(keepAlive, 5000); // Every 5 seconds
  }
}

// Start keepalive immediately
keepAlive();

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

// Handle notification clicks with focus
self.addEventListener('notificationclick', async function(event) {
  event.notification.close();
  
  try {
    // Get all windows
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    // If we have a window open, focus it
    for (const windowClient of windowClients) {
      if (windowClient.url.includes(BASE_PATH)) {
        await windowClient.focus();
        return;
      }
    }
    
    // If no window is open, open one
    await clients.openWindow(`${BASE_PATH}/${event.notification.data.userId || ''}`);
  } catch (error) {
    console.error('Error handling notification click:', error);
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
  
  // Claim control immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      keepAlive(),
      registerPeriodicSync()
    ])
  );
});

// Register for more frequent periodic sync
async function registerPeriodicSync() {
  try {
    if ('periodicSync' in self.registration) {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync',
      });
      
      if (status.state === 'granted') {
        // Try to sync every minute
        await self.registration.periodicSync.register(PERIODIC_SYNC_TAG, {
          minInterval: 60 * 1000 // 1 minute
        });
        console.log('Periodic background sync registered');
      }
    }
  } catch (error) {
    console.error('Error registering periodic background sync:', error);
    // Retry registration
    setTimeout(registerPeriodicSync, 3000);
  }
}

// Handle incoming call notifications with immediate wake up
self.addEventListener('message', async (event) => {
  if (event.data.type === 'INCOMING_CALL') {
    console.log('Incoming call notification received in service worker');
    
    twilioUserId = event.data.userId;
    
    try {
      // Force wake up the app
      const allClients = await clients.matchAll({ 
        type: 'window',
        includeUncontrolled: true
      });
      
      if (allClients.length === 0) {
        // If no window is open, open one
        await clients.openWindow(`${BASE_PATH}/${twilioUserId}`);
      } else {
        // If we have a window, focus it
        await allClients[0].focus();
      }

      // Show high-priority notification
      await self.registration.showNotification('Incoming Call', {
        body: 'Tap to answer the call',
        icon: `${BASE_PATH}/icons/icon-192x192.png`,
        badge: `${BASE_PATH}/icons/icon-72x72.png`,
        vibrate: [200, 100, 200, 100, 200],
        tag: 'call-notification',
        renotify: true,
        priority: 2,
        requireInteraction: true,
        actions: [
          { action: 'answer', title: 'Answer' },
          { action: 'decline', title: 'Decline' }
        ],
        data: { userId: twilioUserId }
      });
    } catch (error) {
      console.error('Error handling incoming call:', error);
    }
  } else if (event.data.type === 'WAKE_UP') {
    twilioConnected = event.data.twilioConnected;
    lastTwilioCheck = Date.now();
    
    // Try to keep alive on wake up
    keepAlive();
  } else if (event.data.type === 'KEEPALIVE') {
    self.registration.active.postMessage({
      type: 'KEEPALIVE_RESPONSE',
      timestamp: Date.now()
    });
  }
});

// Register for periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(
      Promise.all([
        doBackgroundSync(),
        keepAlive()
      ])
    );
  }
});

// Handle background sync
self.addEventListener('sync', event => {
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(
      Promise.all([
        doBackgroundSync(),
        keepAlive()
      ])
    );
  }
});

// Function to check Twilio connection status
const checkTwilioConnection = async () => {
  console.log('Checking Twilio connection status in service worker');
  
  // Reduced the check interval to 10 seconds
  const tenSeconds = 10 * 1000;
  if (Date.now() - lastTwilioCheck > tenSeconds) {
    console.log('It has been more than 10 seconds since the last Twilio check');
    
    try {
      // Try to find an active client to check the connection
      const clients = await self.clients.matchAll({ 
        type: 'window',
        includeUncontrolled: true 
      });

      if (clients.length > 0) {
        console.log('Found active clients:', clients.length);
        clients.forEach(client => {
          client.postMessage({
            type: 'CHECK_TWILIO_CONNECTION',
            timestamp: new Date().toISOString()
          });
        });
      } else {
        console.log('No active clients found, attempting to wake up the app');
        
        // If no active clients and we have a user ID, try multiple wake-up strategies
        if (twilioUserId) {
          // Strategy 1: Show a notification
          await self.registration.showNotification('Reconnecting to Service', {
            body: 'Tap to ensure you receive incoming calls',
            icon: `${BASE_PATH}/icons/icon-192x192.png`,
            badge: `${BASE_PATH}/icons/icon-72x72.png`,
            tag: 'reconnect-notification',
            requireInteraction: true,
            data: { userId: twilioUserId }
          });

          // Strategy 2: Try to claim clients
          await clients.claim();

          // Strategy 3: Focus any existing windows
          const windows = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
          });
          
          if (windows.length > 0) {
            await Promise.all(windows.map(window => window.focus()));
          } else {
            // If no windows exist, open a new one
            await self.clients.openWindow(`${BASE_PATH}/${twilioUserId}`);
          }
        }
      }

      lastTwilioCheck = Date.now();
    } catch (error) {
      console.error('Error in checkTwilioConnection:', error);
      // Retry after error
      setTimeout(checkTwilioConnection, 5000);
    }
  }
};

// Check connection status more frequently
setInterval(checkTwilioConnection, 10000);

// Function to perform background sync operations
async function doBackgroundSync() {
  console.log('Performing background sync...');
  
  try {
    // Check Twilio connection status
    await checkTwilioConnection();
    
    // Send heartbeat to server with more information
    const response = await fetch('https://getcredentials-3757.twil.io/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'heartbeat',
        twilioConnected: twilioConnected,
        userId: twilioUserId,
        lastCheck: lastTwilioCheck,
        isActive: true
      }),
    });
    
    if (!response.ok) {
      throw new Error('Heartbeat failed');
    }

    const data = await response.json();
    
    // If we're not connected to Twilio or server suggests reconnection
    if ((!twilioConnected || data.shouldReconnect) && twilioUserId) {
      const clients = await self.clients.matchAll({ 
        type: 'window',
        includeUncontrolled: true 
      });

      // If no active clients, try to wake up the app
      if (clients.length === 0) {
        // Show a high-priority notification
        await self.registration.showNotification('Service Disconnected', {
          body: 'Tap to reconnect to the calling service',
          icon: `${BASE_PATH}/icons/icon-192x192.png`,
          badge: `${BASE_PATH}/icons/icon-72x72.png`,
          tag: 'reconnect-notification',
          requireInteraction: true,
          priority: 'high',
          data: { 
            userId: twilioUserId,
            timestamp: Date.now()
          }
        });

        // Try to claim and focus clients
        await clients.claim();
        const windows = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
        
        if (windows.length > 0) {
          await Promise.all(windows.map(window => window.focus()));
        }
      } else {
        // Notify all active clients to check connection
        clients.forEach(client => {
          client.postMessage({
            type: 'CHECK_TWILIO_CONNECTION',
            timestamp: new Date().toISOString(),
            shouldReconnect: true
          });
        });
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
    // Retry background sync after error with exponential backoff
    const retrySync = (attempt = 1) => {
      const maxAttempts = 5;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      
      if (attempt <= maxAttempts) {
        setTimeout(() => {
          doBackgroundSync().catch(() => retrySync(attempt + 1));
        }, delay);
      }
    };
    retrySync();
  }
}
