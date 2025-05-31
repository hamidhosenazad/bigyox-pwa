// firebase-messaging-sw.js
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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: payload.data,
    tag: payload.data.callSid,
    requireInteraction: true,
    actions: [
      {
        action: 'answer',
        title: 'Answer'
      },
      {
        action: 'decline',
        title: 'Decline'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data;

  notification.close();

  if (action === 'answer') {
    console.log('Answer call:', data.callSid);
    clients.openWindow(`/#/238`);
  } else if (action === 'decline') {
    console.log('Decline call:', data.callSid);
  }
}); 