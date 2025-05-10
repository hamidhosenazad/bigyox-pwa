/**
 * Heartbeat function for Twilio PWA
 * 
 * This function handles heartbeat requests from the service worker
 * to keep the connection alive and check for any pending notifications.
 */
exports.handler = function(context, event, callback) {
  console.log('Heartbeat received:', event);
  
  // Set CORS headers
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Content-Type', 'application/json');
  
  // Handle OPTIONS request for CORS preflight
  if (event.request && event.request.method === 'OPTIONS') {
    callback(null, response);
    return;
  }
  
  // Extract user ID if provided
  const userId = event.userId;
  
  // Check if there are any pending notifications for this user
  // This is where you would check your database or other storage
  // for any pending notifications or calls for this user
  const pendingNotifications = [];
  
  // For demonstration purposes, we'll just return a success response
  // In a real implementation, you would check for pending calls or messages
  response.setBody({
    success: true,
    timestamp: new Date().toISOString(),
    userId: userId || 'unknown',
    notifications: pendingNotifications
  });
  
  callback(null, response);
};
