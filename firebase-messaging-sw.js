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

// Handle background messages ONLY (this prevents duplicate notifications)
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  console.log('Payload data:', payload.data);

  // Extract data - FCM might wrap it differently
  const messageData = payload.data || payload;
  
  const notificationTitle = messageData.title || 'Incoming Call';
  const notificationOptions = {
    body: messageData.body || 'New call incoming',
    icon: '/icons/icon-192x192.png', // Using existing icon
    badge: '/icons/icon-72x72.png', // Smaller badge icon
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

  // Get the correct user ID from the data
  const userId = data.recipient || '238'; // fallback to 238
  const pwaUrl = `https://sazin.github.io/bigyox-pwa/#/${userId}`;

  if (action === 'answer') {
    console.log('Answer call:', data.callSid);
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        // Check if PWA is already open
        for (let client of clientList) {
          if (client.url.includes('sazin.github.io/bigyox-pwa') && 'focus' in client) {
            client.focus();
            client.navigate(pwaUrl);
            return;
          }
        }
        // If PWA not open, open new window
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
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        // Check if PWA is already open
        for (let client of clientList) {
          if (client.url.includes('sazin.github.io/bigyox-pwa') && 'focus' in client) {
            client.focus();
            client.navigate(pwaUrl);
            return;
          }
        }
        // If PWA not open, open new window
        return clients.openWindow(pwaUrl);
      })
    );
  }
});
