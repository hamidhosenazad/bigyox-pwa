exports.handler = async function(context, event, callback) {
    const response = new Twilio.Response();
    
    // Set CORS headers
    response.appendHeader('Access-Control-Allow-Origin', '*');
    response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.appendHeader('Content-Type', 'application/json');

    try {
        // Handle preflight OPTIONS request
        if (context.httpMethod === 'OPTIONS') {
            response.setStatusCode(200);
            return callback(null, response);
        }

        console.log('Sending notification for:', event);

        const admin = require('firebase-admin');

        let app;
        try {
            app = admin.app();
        } catch (error) {
            console.log('Initializing Firebase Admin...');
            
            // Fetch service account from URL
            const fetch = require('node-fetch');
            const serviceAccountUrl = 'https://getcredentials-3757.twil.io/firebase-service-account.json';
            
            console.log('Fetching service account from URL:', serviceAccountUrl);
            const fetchResponse = await fetch(serviceAccountUrl);
            
            if (!fetchResponse.ok) {
                throw new Error(`Failed to fetch service account: ${fetchResponse.status} ${fetchResponse.statusText}`);
            }
            
            const serviceAccount = await fetchResponse.json();
            console.log('Loaded service account from URL, project_id:', serviceAccount.project_id);

            // Initialize Firebase Admin
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            }, `messaging-app-${Date.now()}`);
            
            console.log('Firebase Admin initialized successfully');
        }

        const userId = event.userId || event.to;
        if (!userId) {
            throw new Error('No userId provided in the request');
        }

        const client = context.getTwilioClient();
        const syncServiceSid = 'IS45d7824102ba723ff4fd508de46d2490';

        try {
            console.log(`Fetching all FCM tokens for user ${userId}...`);
            
            // Get all items from the fcm_tokens map
            const allSyncMapItems = await client.sync.v1
                .services(syncServiceSid)
                .syncMaps('fcm_tokens')
                .syncMapItems
                .list();

            // Filter for this specific user
            const userTokens = allSyncMapItems.filter(item => {
                // Handle both old format (store238) and new format (store238_device123)
                return item.key.startsWith(`store${userId}_`) || item.key === `store${userId}`;
            });

            if (userTokens.length === 0) {
                throw new Error(`No FCM tokens found for user ${userId}`);
            }

            console.log(`Found ${userTokens.length} devices for user ${userId}`);

            const messageData = {
                title: 'Incoming Call',
                body: `Call from ${event.from || 'Unknown'}`,
                callSid: event.callSid || 'unknown',
                caller: event.from || 'Unknown',
                recipient: event.to || userId,
                userId: userId,
                type: 'incoming_call'
            };

            const baseMessage = {
                data: messageData,
                android: {
                    priority: 'high'
                },
                apns: {
                    payload: {
                        aps: {
                            'content-available': 1,
                            priority: 10
                        }
                    }
                }
            };

            const results = [];
            const errors = [];

            // Send notification to each device
            for (const tokenItem of userTokens) {
                try {
                    const fcmToken = tokenItem.data.fcmToken;
                    const deviceId = tokenItem.data.deviceId || 'unknown';
                    
                    if (!fcmToken) {
                        console.warn(`No FCM token for ${tokenItem.key}`);
                        continue;
                    }

                    const message = {
                        ...baseMessage,
                        token: fcmToken
                    };

                    console.log(`Sending to device ${deviceId} (${tokenItem.key}):`, fcmToken.substring(0, 20) + '...');
                    const result = await app.messaging().send(message);
                    
                    results.push({
                        device: deviceId,
                        identity: tokenItem.key,
                        messageId: result,
                        success: true
                    });

                } catch (sendError) {
                    console.error(`Failed to send to ${tokenItem.key}:`, sendError.message);
                    errors.push({
                        device: tokenItem.data.deviceId || 'unknown',
                        identity: tokenItem.key,
                        error: sendError.message,
                        success: false
                    });
                }
            }

            console.log(`Notification sent to ${results.length} devices, ${errors.length} failed`);

            response.setStatusCode(200);
            response.setBody({
                success: true,
                userId: userId,
                totalDevices: userTokens.length,
                successfulSends: results.length,
                failedSends: errors.length,
                results: results,
                errors: errors
            });

        } catch (syncError) {
            console.error('Error fetching FCM tokens from Sync:', syncError);
            throw new Error(`Failed to get FCM tokens for user ${userId}: ${syncError.message}`);
        }

    } catch (error) {
        console.error('Firebase error:', error);
        response.setStatusCode(500);
        response.setBody({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }

    return callback(null, response);
}; 