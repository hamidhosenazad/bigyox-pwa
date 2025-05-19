import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA functionality ONLY in production
// This is the recommended approach for Create React App
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = '/bigyox-pwa/service-worker.js';
      
    navigator.serviceWorker.register(swPath)
      .then(registration => {
        console.log('ServiceWorker registration successful');
        
        // Request notification permission on service worker registration
        if ('Notification' in window) {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              // Subscribe to push notifications here if needed
            }
          });
        }
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
} else {
  // Service worker is disabled in development mode
  console.log('SW disabled in dev mode');
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
