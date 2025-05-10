import { useEffect, useRef } from 'react';

/**
 * BackgroundServiceManager - A React hook to manage background services for PWA
 * 
 * This hook handles:
 * 1. Wake Lock - Prevents device from sleeping
 * 2. Background Sync - Registers for background sync
 * 3. Periodic Sync - Registers for periodic background sync
 * 4. Service Worker Heartbeat - Keeps service worker alive
 */
const useBackgroundServiceManager = () => {
  const wakeLockRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  
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
      navigator.serviceWorker.controller.postMessage({
        type: 'WAKE_UP',
        timestamp: new Date().toISOString()
      });
    }
  };
  
  // Setup all background services
  useEffect(() => {
    const setupBackgroundServices = async () => {
      // Acquire wake lock to prevent device from sleeping
      await acquireWakeLock();
      
      // Register for background sync
      await registerBackgroundSync();
      
      // Register for periodic background sync
      await registerPeriodicSync();
      
      // Setup heartbeat interval to keep service worker alive
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, 5 * 60 * 1000); // Every 5 minutes
      
      // Send initial heartbeat
      sendHeartbeat();
      
      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from Service Worker:', event.data);
      });
    };
    
    // Setup background services when component mounts
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setupBackgroundServices();
      });
    }
    
    // Document visibility change handler to re-acquire wake lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    };
    
    // Listen for visibility change events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup function
    return () => {
      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(err => {
          console.error('Failed to release Wake Lock:', err);
        });
      }
      
      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      // Remove event listener
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  return {
    acquireWakeLock,
    registerBackgroundSync,
    registerPeriodicSync,
    sendHeartbeat
  };
};

export default useBackgroundServiceManager;
