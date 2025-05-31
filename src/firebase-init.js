// src/firebase-init.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAhH53y2wD18i2VBRrrBBPz4MiOIO30xO0",
  authDomain: "bigyox-pwa.firebaseapp.com",
  projectId: "bigyox-pwa",
  storageBucket: "bigyox-pwa.firebasestorage.app",
  messagingSenderId: "972017471932",
  appId: "1:972017471932:web:73a377145c0b6aa92f5bb9",
  measurementId: "G-T46CCYC0FC"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ✅ Initialize messaging for push
const messaging = getMessaging(app);

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY' // You'll need to add your VAPID key here
      });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

// Handle foreground messages
onMessage(messaging, (payload) => {
  console.log('Received foreground message:', payload);
  // You can show a custom notification here if needed
  new Notification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/logo192.png'
  });
});

// ✅ Export messaging to use in index.js
export { messaging };
