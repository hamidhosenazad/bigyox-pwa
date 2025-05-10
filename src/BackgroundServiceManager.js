import { useEffect, useRef, useState } from 'react';
import { Device } from '@twilio/voice-sdk';

/**
 * BackgroundServiceManager - A React hook to manage background services for PWA
 * 
 * This hook handles:
 * 1. Wake Lock - Prevents device from sleeping
 * 2. Background Sync - Registers for background sync
 * 3. Periodic Sync - Registers for periodic background sync
 * 4. Service Worker Heartbeat - Keeps service worker alive
 * 5. Twilio Connection - Maintains persistent Twilio connection
 */
const useBackgroundServiceManager = () => {
  const wakeLockRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const twilioCheckIntervalRef = useRef(null);
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Function to acquire wake lock
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        // Release any existing wake lock
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
        
        // Acquire a new wake lock
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('Wake Lock acquired');
        
        // Re-acquire wake lock if it's released
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock released');
          // Try to re-acquire the wake lock
          setTimeout(acquireWakeLock, 1000);
        });
      } else {
        console.log('Wake Lock API not supported');
      }
    } catch (err) {
      console.error('Failed to acquire Wake Lock:', err);
    }
  };
  
  // Function to register for background sync
  const registerBackgroundSync = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        if ('sync' in registration) {
          await registration.sync.register('twilio-sync');
          console.log('Background Sync registered');
        } else {
          console.log('Background Sync not supported');
        }
      }
    } catch (err) {
      console.error('Failed to register for Background Sync:', err);
    }
  };
  
  // Function to register for periodic background sync
  const registerPeriodicSync = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        if ('periodicSync' in registration) {
          // Check permission
          const status = await navigator.permissions.query({
            name: 'periodic-background-sync',
          });
          
          if (status.state === 'granted') {
            await registration.periodicSync.register('twilio-periodic-sync', {
              minInterval: 15 * 60 * 1000, // 15 minutes
            });
            console.log('Periodic Background Sync registered');
          } else {
            console.log('Periodic Background Sync permission not granted');
          }
        } else {
          console.log('Periodic Background Sync not supported');
        }
      }
    } catch (err) {
      console.error('Failed to register for Periodic Background Sync:', err);
    }
  };
  
  // Function to send heartbeat to service worker
  const sendHeartbeat = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Include Twilio connection status in the heartbeat
      navigator.serviceWorker.controller.postMessage({
        type: 'WAKE_UP',
        timestamp: new Date().toISOString(),
        twilioConnected: isConnected
      });
    }
  };
  
  // Function to get Twilio token from local storage or server
  const getTwilioToken = async (userId) => {
    try {
      // First check if we have a cached token
      const cachedToken = localStorage.getItem('twilioToken');
      const cachedTokenExpiry = localStorage.getItem('twilioTokenExpiry');
      const userId = localStorage.getItem('twilioUserId');
      
      // If we have a valid cached token that's not expired, use it
      if (cachedToken && cachedTokenExpiry && userId) {
        const expiryTime = parseInt(cachedTokenExpiry, 10);
        if (expiryTime > Date.now()) {
          return { token: cachedToken, userId };
        }
      }
      
      // If no valid cached token, fetch a new one
      if (!userId) {
        throw new Error('No user ID available for Twilio connection');
      }
      
      const response = await fetch(`https://getcredentials-3757.twil.io/getCredentials?userId=${userId}`);
      const data = await response.json();
      
      if (!data.token) {
        throw new Error('No token received from server');
      }
      
      // Cache the token with a 23-hour expiry (Twilio tokens typically last 24 hours)
      localStorage.setItem('twilioToken', data.token);
      localStorage.setItem('twilioTokenExpiry', (Date.now() + 23 * 60 * 60 * 1000).toString());
      localStorage.setItem('twilioUserId', userId);
      
      return { token: data.token, userId };
    } catch (error) {
      console.error('Error getting Twilio token:', error);
      throw error;
    }
  };
  
  // Function to connect to Twilio
  const connectToTwilio = async (userId) => {
    try {
      // If already connected, don't reconnect
      if (twilioDevice && isConnected) {
        return;
      }
      
      // Get token for Twilio connection
      const { token } = await getTwilioToken(userId);
      
      // Create a new Twilio device with more aggressive connection settings
      const device = new Device(token, {
        enableRingingState: true,
        edge: ['ashburn', 'sydney', 'roaming', 'frankfurt', 'dublin'],
        region: 'gll',
        sounds: { incoming: null },
        allowIncomingWhileBusy: true,
        closeProtection: true, // Prevent accidental disconnection
        keepaliveTimeoutMs: 30000, // More frequent keepalive
        maxReconnectAttempts: Infinity, // Always try to reconnect
        reconnectTimeoutMs: 3000 // Faster reconnection attempts
      });
      
      // Set up event handlers
      device.on('registered', () => {
        console.log('Twilio device registered');
        setIsConnected(true);
        localStorage.setItem('twilioConnected', 'true');
        // Send heartbeat immediately after registration
        sendHeartbeat();
      });
      
      device.on('unregistered', () => {
        console.log('Twilio device unregistered');
        setIsConnected(false);
        localStorage.setItem('twilioConnected', 'false');
        // Try to re-register immediately
        device.register().catch(err => {
          console.error('Failed to re-register:', err);
          reconnectToTwilio();
        });
      });
      
      device.on('error', (error) => {
        console.error('Twilio device error:', error);
        setIsConnected(false);
        localStorage.setItem('twilioConnected', 'false');
        
        // Try to reconnect immediately after error
        setTimeout(() => {
          reconnectToTwilio();
        }, 1000);
      });
      
      device.on('incoming', (connection) => {
        // Notify the service worker about incoming call
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'INCOMING_CALL',
            timestamp: new Date().toISOString(),
            userId: userId
          });
        }
        
        // Store the connection in localStorage
        localStorage.setItem('incomingCallTimestamp', Date.now().toString());
        
        // Wake up the app if it's in background
        if (document.visibilityState === 'hidden') {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Incoming Call', {
              body: 'Tap to answer the call',
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
              vibrate: [200, 100, 200, 100, 200],
              tag: 'call-notification',
              renotify: true,
              requireInteraction: true,
              actions: [
                { action: 'answer', title: 'Answer' },
                { action: 'decline', title: 'Decline' }
              ],
              data: { userId: userId }
            });
          });
        }
      });
      
      // Register the device
      await device.register();
      setTwilioDevice(device);
      
      return device;
    } catch (error) {
      console.error('Error connecting to Twilio:', error);
      setIsConnected(false);
      localStorage.setItem('twilioConnected', 'false');
      
      // Try to reconnect after error with shorter delay
      setTimeout(() => {
        reconnectToTwilio();
      }, 3000);
    }
  };
  
  // Function to reconnect to Twilio
  const reconnectToTwilio = async () => {
    try {
      // Get the user ID from local storage
      const userId = localStorage.getItem('twilioUserId');
      
      if (!userId) {
        console.log('No user ID available for reconnection');
        return;
      }
      
      // If we have an existing device, destroy it
      if (twilioDevice) {
        try {
          twilioDevice.destroy();
        } catch (err) {
          console.error('Error destroying Twilio device:', err);
        }
      }
      
      // Connect with a new device
      await connectToTwilio(userId);
    } catch (error) {
      console.error('Error reconnecting to Twilio:', error);
      
      // Schedule another reconnection attempt
      setTimeout(() => {
        reconnectToTwilio();
      }, 30000);
    }
  };
  
  // Function to check Twilio connection status and reconnect if needed
  const checkTwilioConnection = () => {
    const userId = localStorage.getItem('twilioUserId');
    
    if (!userId) {
      return;
    }
    
    if (!isConnected) {
      console.log('Twilio not connected, attempting to reconnect...');
      reconnectToTwilio();
    } else {
      console.log('Twilio connection check: Connected');
    }
  };
  
  // Function to handle visibility change
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      // App is visible again
      await acquireWakeLock();
      await connectToTwilio(localStorage.getItem('twilioUserId'));
      sendHeartbeat();
    } else {
      // App is in background
      // Don't release wake lock here, keep it active
      // Just ensure Twilio connection stays alive
      if (twilioDevice && isConnected) {
        // Send a heartbeat to keep the connection alive
        sendHeartbeat();
      }
    }
  };
  
  // Setup background services
  const setupBackgroundServices = async () => {
    try {
      // Get stored user ID
      const userId = localStorage.getItem('twilioUserId');
      
      if (!userId) {
        console.log('No user ID available');
        return;
      }

      // Acquire wake lock immediately
      await acquireWakeLock();
      
      // Register for background sync with retry
      const registerBackgroundSyncWithRetry = async (retries = 3) => {
        try {
          await registerBackgroundSync();
        } catch (error) {
          if (retries > 0) {
            setTimeout(() => registerBackgroundSyncWithRetry(retries - 1), 1000);
          }
        }
      };
      await registerBackgroundSyncWithRetry();
      
      // Register for periodic sync with retry
      const registerPeriodicSyncWithRetry = async (retries = 3) => {
        try {
          await registerPeriodicSync();
        } catch (error) {
          if (retries > 0) {
            setTimeout(() => registerPeriodicSyncWithRetry(retries - 1), 1000);
          }
        }
      };
      await registerPeriodicSyncWithRetry();
      
      // Connect to Twilio
      await connectToTwilio(userId);
      
      // Set up visibility change listener
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Start heartbeat interval (every 15 seconds)
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);
      
      // Start Twilio connection check interval (every 30 seconds)
      twilioCheckIntervalRef.current = setInterval(() => {
        checkTwilioConnection();
      }, 30000);
      
      // Register event listener for service worker messages
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', async (event) => {
          if (event.data.type === 'CHECK_TWILIO_CONNECTION') {
            await checkTwilioConnection();
          }
        });
      }
    } catch (error) {
      console.error('Error setting up background services:', error);
      // Retry setup after error
      setTimeout(setupBackgroundServices, 5000);
    }
  };
  
  // Setup all background services
  useEffect(() => {
    // Setup background services when component mounts
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setupBackgroundServices();
      });
    }
    
    // Cleanup function
    return () => {
      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(err => {
          console.error('Failed to release Wake Lock:', err);
        });
      }
      
      // Clear intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      if (twilioCheckIntervalRef.current) {
        clearInterval(twilioCheckIntervalRef.current);
      }
      
      // Remove event listener
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Don't destroy the Twilio device on cleanup to keep it running in the background
    };
  }, [isConnected, twilioDevice]);
  
  return {
    acquireWakeLock,
    registerBackgroundSync,
    registerPeriodicSync,
    sendHeartbeat,
    connectToTwilio,
    reconnectToTwilio,
    checkTwilioConnection,
    isConnected,
    twilioDevice
  };
};

export default useBackgroundServiceManager;
