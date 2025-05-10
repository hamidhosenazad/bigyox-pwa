/**
 * Heartbeat function for Twilio PWA
 * 
 * This function handles heartbeat requests from the service worker
 * to keep the connection alive and check for any pending notifications.
 * It also monitors Twilio connection status and can trigger reconnection.
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
  
  // Extract user ID and Twilio connection status if provided
  const userId = event.userId;
  const twilioConnected = event.twilioConnected === true;
  
  // Check if there are any pending notifications for this user
  // This is where you would check your database or other storage
  // for any pending notifications or calls for this user
  const pendingNotifications = [];
  
  // If we have a user ID but Twilio is not connected, add a reconnection notification
  if (userId && !twilioConnected) {
    pendingNotifications.push({
      title: 'Reconnect to Twilio',
      body: 'Your connection to Twilio has been lost. Tap to reconnect.',
      data: {
        userId: userId,
        action: 'reconnect'
      }
    });
  }
  
  // Check for missed calls or messages in Twilio logs
  // This would typically involve querying Twilio's API to check for missed calls
  // For demonstration purposes, we'll just simulate this check
  const checkForMissedCalls = async (userId) => {
    if (!userId) return [];
    
    try {
      // In a real implementation, you would use the Twilio SDK to check for missed calls
      // For example:
      // const client = context.getTwilioClient();
      // const calls = await client.calls.list({to: userPhoneNumber, status: 'no-answer'});
      
      // For demonstration, we'll just return an empty array
      return [];
    } catch (error) {
      console.error('Error checking for missed calls:', error);
      return [];
    }
  };
  
  // If we have a user ID, check for missed calls
  if (userId) {
    checkForMissedCalls(userId)
      .then(missedCalls => {
        // Add notifications for missed calls
        missedCalls.forEach(call => {
          pendingNotifications.push({
            title: 'Missed Call',
            body: `You missed a call from ${call.from}`,
            data: {
              userId: userId,
              callSid: call.sid
            }
          });
        });
        
        // Send the response
        response.setBody({
          success: true,
          timestamp: new Date().toISOString(),
          userId: userId || 'unknown',
          twilioConnected: twilioConnected,
          shouldReconnect: !twilioConnected,
          notifications: pendingNotifications
        });
        
        callback(null, response);
      })
      .catch(error => {
        console.error('Error in heartbeat function:', error);
        
        // Send the response with an error
        response.setBody({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
          userId: userId || 'unknown',
          twilioConnected: twilioConnected,
          shouldReconnect: !twilioConnected,
          notifications: pendingNotifications
        });
        
        callback(null, response);
      });
  } else {
    // If we don't have a user ID, just send the response
    response.setBody({
      success: true,
      timestamp: new Date().toISOString(),
      userId: 'unknown',
      twilioConnected: false,
      shouldReconnect: false,
      notifications: pendingNotifications
    });
    
    callback(null, response);
  }
};
