// Function to register FCM token with Twilio
export const registerFCMToken = async (userId, fcmToken) => {
  try {
    console.log('📱 Registering FCM token for userId:', userId);
    console.log('🎯 FCM Token:', fcmToken);
    
    const response = await fetch('https://getcredentials-3757.twil.io/registerPushNotification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        fcmToken: fcmToken,
        platform: 'fcm'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ FCM token registered successfully:', result);
      return result;
    } else {
      throw new Error(result.error || 'Failed to register FCM token');
    }
  } catch (error) {
    console.error('❌ Failed to register FCM token:', error);
    throw error;
  }
};

// Function to mark PWA as ready to accept call
export const markPwaReady = async (callSid) => {
  try {
    console.log('🟡 Marking PWA as ready for call:', callSid);
    
    const response = await fetch('https://getcredentials-3757.twil.io/markPwaReady', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callSid: callSid
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ PWA marked as ready:', result);
      return result;
    } else {
      throw new Error(result.error || 'Failed to mark PWA as ready');
    }
  } catch (error) {
    console.error('❌ Failed to mark PWA as ready:', error);
    throw error;
  }
};

// Function to handle call notifications
export const handleCallNotification = async (payload) => {
  console.log('📞 Handling call notification:', payload);
  
  try {
    // Extract call information
    const callData = payload.data || payload;
    const callSid = callData.callSid;
    const userId = callData.userId;
    const from = callData.caller || callData.from;
    
    if (callSid && userId) {
      console.log('📱 App is active and can receive calls, marking as ready');
      // Mark PWA as ready when notification is received and app is active
      await markPwaReady(callSid);
      
      // Show user-friendly call interface since app is open
      const userResponse = window.confirm(`📞 Incoming call from ${from}\n\nClick OK to answer the call, or Cancel to dismiss.`);
      
      if (userResponse) {
        console.log('✅ User chose to answer the call');
        // Mark as ready again to ensure connection
        await markPwaReady(callSid);
      } else {
        console.log('❌ User dismissed the call notification');
      }
      
    } else {
      console.warn('⚠️ Missing callSid or userId in notification payload');
    }
  } catch (error) {
    console.error('❌ Error handling call notification:', error);
  }
}; 