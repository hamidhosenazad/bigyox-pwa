// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAhH53y2wD18i2VBRrrBBPz4MiOIO30xO0",
  authDomain: "bigyox-pwa.firebaseapp.com",
  projectId: "bigyox-pwa",
  storageBucket: "bigyox-pwa.firebasestorage.app",
  messagingSenderId: "972017471932",
  appId: "1:972017471932:web:73a377145c0b6aa92f5bb9",
  measurementId: "G-T46CCYC0FC"
});

const messaging = firebase.messaging();

// Cache the icons
const CACHE_NAME = 'notification-icons-v1';
const ICONS_TO_CACHE = [
  '/icons/call-icon.png',
  '/icons/call-badge.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching notification icons');
        return cache.addAll(ICONS_TO_CACHE);
      })
  );
});

// Function to mark PWA as ready
const markPwaReady = async (callSid) => {
  try {
    console.log(`📱 SW: Marking PWA ready for call ${callSid}`);
    
    const response = await fetch('https://getcredentials-3757.twil.io/markPwaReady', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callSid: callSid
      }),
    });

    const result = await response.json();
    console.log('✅ SW: PWA marked as ready:', result);
    return result;
  } catch (error) {
    console.error('❌ SW: Error marking PWA ready:', error);
  }
};

// Handle background messages ONLY (this prevents duplicate notifications)
messaging.onBackgroundMessage(async (payload) => {
  console.log('Received background message:', payload);
  console.log('Payload data:', payload.data);

  // Extract data - FCM might wrap it differently
  const messageData = payload.data || payload;
  const callSid = messageData.callSid;
  
  // DON'T mark PWA as ready yet - app is closed and can't receive calls
  // Only mark ready when user actually opens the app by tapping notification
  console.log('📱 SW: PWA is closed, showing notification but NOT marking ready yet');
  
  const notificationTitle = messageData.title || 'Incoming Call';
  const notificationOptions = {
    body: messageData.body || 'New call incoming',
    icon: '/icons/call-icon.png',
    badge: '/icons/call-badge.png',
    data: messageData,
    tag: messageData.callSid || 'call-notification',
    requireInteraction: true,
    vibrate: [500, 1000, 500, 1000, 500],
    silent: false,
    actions: [
      {
        action: 'answer',
        title: '📞 Answer'
      },
      {
        action: 'decline', 
        title: '❌ Decline'
      }
    ]
  };

  // Ensure icons are cached before showing notification
  try {
    const cache = await caches.open(CACHE_NAME);
    const iconResponse = await cache.match('/icons/call-icon.png');
    const badgeResponse = await cache.match('/icons/call-badge.png');

    if (!iconResponse || !badgeResponse) {
      console.log('Caching icons before showing notification');
      await cache.addAll(ICONS_TO_CACHE);
    }
  } catch (error) {
    console.error('Error caching icons:', error);
  }

  console.log('Showing notification with options:', notificationOptions);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data;

  console.log('Notification clicked:', { action, data });
  notification.close();

  // Extract userId from the stored token identity, NOT from phone number
  // The userId should be stored when we register the FCM token
  const userId = data.userId || data.recipient || '238'; // fallback to 238
  const callSid = data.callSid;
  const pwaUrl = `https://hamidhosenazad.github.io/bigyox-pwa/#/${userId}`;

  // PWA will mark itself as ready when it actually opens and loads
  console.log('📱 SW: Opening PWA, letting it mark itself ready when loaded');

  if (action === 'answer') {
    console.log('Answer call:', data.callSid);
    event.waitUntil(
      clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      }).then(clientList => {
        // Check if PWA is already open
        for (let client of clientList) {
          if (client.url.includes('hamidhosenazad.github.io/bigyox-pwa') && 'focus' in client) {
            client.focus();
            client.navigate(pwaUrl);
            // Send message to client about the call - let the client mark itself ready
            client.postMessage({
              type: 'CALL_ANSWERED',
              callSid: callSid,
              userId: userId
            });
            return;
          }
        }
        // If PWA not open, open new window - PWA will mark itself ready when it loads
        return clients.openWindow(pwaUrl);
      })
    );
  } else if (action === 'decline') {
    console.log('Decline call:', data.callSid);
    // Just close notification for decline - no need to open PWA
    event.waitUntil(
      fetch('/api/decline-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callSid: data.callSid }),
      }).catch(err => console.log('Decline API error:', err))
    );
  } else {
    // Default click (no action button) - open PWA
    console.log('Default notification click');
    event.waitUntil(
      clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      }).then(clientList => {
        // Check if PWA is already open
        for (let client of clientList) {
          if (client.url.includes('hamidhosenazad.github.io/bigyox-pwa') && 'focus' in client) {
            client.focus();
            client.navigate(pwaUrl);
            // Send message to client about the call - let the client mark itself ready
            client.postMessage({
              type: 'CALL_NOTIFICATION_CLICKED',
              callSid: callSid,
              userId: userId
            });
            return;
          }
        }
        // If PWA not open, open new window - PWA will mark itself ready when it loads
        return clients.openWindow(pwaUrl);
      })
    );
  }
});
