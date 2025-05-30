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

// Function to play ringtone sound
const playRingtone = async () => {
  try {
    // Create audio context for background audio
    const audio = new Audio('/ringtone.mp3');
    audio.loop = true; // Loop the ringtone until user interacts
    audio.volume = 1.0; // Maximum volume
    
    // Store audio reference to stop later
    self.currentRingtone = audio;
    
    await audio.play();
    console.log('🔊 Ringtone started playing');
    
    // Stop ringtone after 30 seconds if no interaction
    setTimeout(() => {
      if (self.currentRingtone) {
        self.currentRingtone.pause();
        self.currentRingtone = null;
        console.log('🔇 Ringtone stopped after timeout');
      }
    }, 30000);
    
  } catch (error) {
    console.log('⚠️ Could not play ringtone:', error);
  }
};

// Function to stop ringtone
const stopRingtone = () => {
  if (self.currentRingtone) {
    self.currentRingtone.pause();
    self.currentRingtone = null;
    console.log('🔇 Ringtone stopped');
  }
};

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
  
  const notificationTitle = messageData.title || '📞 Incoming Call';
  const notificationOptions = {
    body: messageData.body || '📱 Tap to answer the call',
    icon: '/icons/icon-192x192.png', // Using existing icon
    badge: '/icons/icon-72x72.png', // Smaller badge icon
    data: messageData,
    tag: messageData.callSid || 'call-notification',
    requireInteraction: true,
    // Enhanced vibration pattern for incoming calls (like a phone ringing)
    // Pattern: [vibrate, pause, vibrate, pause...] in milliseconds
    vibrate: [1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500],
    silent: false,
    // Add custom sound if supported
    sound: '/ringtone.mp3',
    // High priority for call notifications
    priority: 'high',
    // Keep notification visible until user interacts
    sticky: true,
    // Additional options for better visibility
    timestamp: Date.now(),
    // Visual indicators
    image: '/icons/icon-192x192.png',
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
  
  // Play ringtone for incoming call
  playRingtone();
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data;

  console.log('Notification clicked:', { action, data });
  
  // Stop ringtone immediately when user interacts
  stopRingtone();
  
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
