const admin = require('firebase-admin');

exports.handler = async function(context, event, callback) {
  const response = new Twilio.Response();
  
  // Set CORS headers
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Content-Type', 'application/json');

  // Handle OPTIONS request
  if (event.request && event.request.method === 'OPTIONS') {
    callback(null, response);
    return;
  }

  try {
    const { userId, fcmToken, platform } = event;

    if (!userId || !fcmToken) {
      throw new Error('User ID and FCM token are required');
    }

    console.log('Registering FCM token for user:', userId);

    const client = context.getTwilioClient();
    
    // Create sync map if it doesn't exist
    try {
      await client.sync.services(context.SYNC_SERVICE_SID).syncMaps('fcm_tokens').fetch();
      console.log('Sync map exists');
    } catch (e) {
      console.log('Creating fcm_tokens sync map...');
      await client.sync.services(context.SYNC_SERVICE_SID).syncMaps.create({uniqueName: 'fcm_tokens'});
      console.log('Sync map created successfully');
    }
    
    // Store the token
    try {
      await client.sync.services(context.SYNC_SERVICE_SID)
        .syncMaps('fcm_tokens')
        .syncMapItems
        .create({
          key: `store${userId}`,
          data: { fcmToken, userId, platform: platform || 'fcm', timestamp: new Date().toISOString() }
        });
      console.log('FCM token stored successfully');
    } catch (e) {
      // Update if exists
      console.log('Updating existing FCM token...');
      await client.sync.services(context.SYNC_SERVICE_SID)
        .syncMaps('fcm_tokens')
        .syncMapItems(`store${userId}`)
        .update({
          data: { fcmToken, userId, platform: platform || 'fcm', timestamp: new Date().toISOString() }
        });
      console.log('FCM token updated successfully');
    }

    response.setBody({
      success: true,
      userId,
      identity: `store${userId}`,
      platform: 'fcm'
    });

  } catch (error) {
    console.error('Error registering FCM token:', error);
    response.setStatusCode(400);
    response.setBody({
      success: false,
      error: error.message
    });
  }

  callback(null, response);
};