import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { messaging } from './firebase-init';
import { getToken, onMessage } from "firebase/messaging";
import { handleCallNotification, markPwaReady, registerFCMToken } from './utils/twilioUtils';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Function to extract userId from URL hash
const getUserIdFromUrl = () => {
  const hash = window.location.hash.substring(1); // Remove the # symbol
  console.log('🔍 Raw hash:', hash);
  
  // Handle different URL formats:
  // #/238 -> 238
  // #238 -> 238  
  // /238 -> 238
  // 238 -> 238
  
  if (hash) {
    // Remove leading slash if present
    const cleanHash = hash.startsWith('/') ? hash.substring(1) : hash;
    console.log('🔍 Clean hash:', cleanHash);
    
    // Check if it's a valid userId (should be numeric for extension)
    if (cleanHash && cleanHash.match(/^\d+$/)) {
      console.log('✅ Valid userId found:', cleanHash);
      return cleanHash;
    } else {
      console.log('❌ Invalid userId format:', cleanHash);
    }
  }
  
  // Fallback: try to extract from pathname
  const pathname = window.location.pathname;
  console.log('🔍 Pathname:', pathname);
  
  if (pathname && pathname !== '/') {
    const pathUserId = pathname.replace('/', '');
    if (pathUserId.match(/^\d+$/)) {
      console.log('✅ Valid userId found in pathname:', pathUserId);
      return pathUserId;
    }
  }
  
  console.log('❌ No userId found in URL');
  return null;
};

// Store for tracking pending calls
let pendingCalls = new Set();
let currentUserId = null;

// Get userId from URL immediately when script loads
const userId = getUserIdFromUrl();
currentUserId = userId;
console.log('🆔 Current URL:', window.location.href);
console.log('🆔 URL Hash:', window.location.hash);
console.log('🆔 Extracted userId:', currentUserId);

// Function to check for pending calls and mark PWA as ready
const checkAndMarkPendingCallsReady = async () => {
  if (!currentUserId) {
    console.log('ℹ️ No userId available for checking pending calls');
    return;
  }
  
  try {
    console.log('🔍 Checking for pending calls for userId:', currentUserId);
    
    // Query Twilio for any pending calls for this user
    const response = await fetch('https://getcredentials-3757.twil.io/twilio-get-pending-calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get pending calls: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('📋 Pending calls result:', result);
    
    if (result.success && result.pendingCalls && result.pendingCalls.length > 0) {
      console.log(`🟡 Found ${result.pendingCalls.length} pending calls, marking them as ready`);
      
      // Mark each pending call as ready
      const { markPwaReady } = await import('./utils/twilioUtils');
      
      for (const call of result.pendingCalls) {
        try {
          console.log(`🟡 Marking call ${call.callSid} as ready (from: ${call.from})`);
          await markPwaReady(call.callSid);
          console.log(`✅ Successfully marked call ${call.callSid} as ready`);
        } catch (error) {
          console.error(`❌ Failed to mark call ${call.callSid} as ready:`, error);
        }
      }
    } else {
      console.log('ℹ️ No pending calls found for this user');
    }
    
  } catch (error) {
    console.error('❌ Error checking pending calls:', error);
  }
};

// Listen for page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('👁️ PWA became visible - checking for pending calls');
    checkAndMarkPendingCallsReady();
  } else {
    console.log('🙈 PWA became hidden');
  }
});

// Listen for window focus events
window.addEventListener('focus', () => {
  console.log('🎯 PWA got focus - checking for pending calls');
  checkAndMarkPendingCallsReady();
});

// Listen for window blur events
window.addEventListener('blur', () => {
  console.log('😴 PWA lost focus');
});

// Listen for messages from service worker
navigator.serviceWorker.addEventListener('message', async (event) => {
  console.log('📬 Message from service worker:', event.data);
  
  const { type, callSid, userId } = event.data;
  
  if (type === 'CALL_ANSWERED' || type === 'CALL_NOTIFICATION_CLICKED') {
    console.log(`📞 Handling ${type} for call ${callSid}`);
    
    if (callSid) {
      try {
        // Now that PWA is open, mark it as ready to receive the call
        await markPwaReady(callSid);
        console.log('✅ PWA marked as ready after opening from notification');
        
        // Show user-friendly call interface
        const userResponse = window.confirm(`📞 Incoming call\n\nClick OK to answer the call, or Cancel to dismiss.`);
        
        if (userResponse) {
          console.log('✅ User chose to answer the call');
          // Mark as ready again to ensure connection
          await markPwaReady(callSid);
        } else {
          console.log('❌ User dismissed the call notification');
        }
      } catch (error) {
        console.error('❌ Error handling service worker call message:', error);
      }
    }
  }
});

// Register Firebase service worker for background messaging
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Use correct path for GitHub Pages deployment
      const swPath = process.env.NODE_ENV === 'production' 
        ? './firebase-messaging-sw.js'  // Relative path for GitHub Pages
        : '/firebase-messaging-sw.js';   // Absolute path for local development
        
      const registration = await navigator.serviceWorker.register(swPath);
      console.log('✅ Firebase Messaging SW registered:', registration.scope);

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        try {
          const token = await getToken(messaging, {
            vapidKey: "BDy7JkFl_HOvmPKiESaJdyA-amCpJXyUbIk9uVr7eZqL2aXyKbr7zfe-z0-3Aq_Li1eBjcZ52w2CUGl7x2XTLeo",
            serviceWorkerRegistration: registration,
          });
          console.log("🎯 FCM Token:", token);

          if (currentUserId) {
            console.log("📱 PWA ready for notifications. Extension:", currentUserId);
            
            // Register FCM token with Twilio
            try {
              const registrationResult = await registerFCMToken(currentUserId, token);
              console.log("✅ FCM token registered with Twilio:", registrationResult);
            } catch (error) {
              console.error("❌ Failed to register FCM token with Twilio:", error);
            }
            
            // Check for any pending calls on startup
            checkAndMarkPendingCallsReady();
          } else {
            console.warn("⚠️ No userId found in URL");
          }
        } catch (err) {
          console.error("❌ Error getting FCM token:", err);
        }
      } else {
        console.warn("❗ Notification permission denied.");
      }
    } catch (err) {
      console.error('❌ Service Worker registration failed:', err);
    }
  });
}

// Handle foreground messages
onMessage(messaging, async (payload) => {
  console.log('📬 Foreground FCM message received:', payload);
  console.log('📬 Full payload details:', JSON.stringify(payload, null, 2));
  
  try {
    // Handle the call notification
    await handleCallNotification(payload);
    
    // Extract call data for marking ready
    const callData = payload.data || payload;
    const callSid = callData.callSid;
    
    if (callSid) {
      console.log('🟡 Attempting to mark PWA ready for callSid:', callSid);
      try {
        await markPwaReady(callSid);
        console.log('✅ Successfully marked PWA ready for call:', callSid);
      } catch (error) {
        console.error('❌ Failed to mark PWA ready:', error);
      }
    } else {
      console.warn('⚠️ No callSid found in FCM payload');
    }
  } catch (error) {
    console.error('❌ Error handling FCM notification:', error);
  }
});

reportWebVitals();
