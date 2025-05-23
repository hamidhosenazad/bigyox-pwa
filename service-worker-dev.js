// This is a minimal development service worker
// Its purpose is just to satisfy the registration without errors

self.addEventListener('install', event => {
  console.log('Dev Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Dev Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // Just pass through all fetch requests
  // No caching in development
});

console.log('Development service worker loaded'); 