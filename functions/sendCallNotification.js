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
            
            // Use environment variables for Firebase service account
            const serviceAccount = {
                type: "service_account",
                project_id: context.FIREBASE_PROJECT_ID,
                private_key_id: context.FIREBASE_PRIVATE_KEY_ID,
                private_key: context.FIREBASE_PRIVATE_KEY ? context.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
                client_email: context.FIREBASE_CLIENT_EMAIL,
                client_id: context.FIREBASE_CLIENT_ID,
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: context.FIREBASE_CLIENT_X509_CERT_URL
            };
            
            console.log('Using environment variables for Firebase service account');
            console.log('Project ID:', serviceAccount.project_id);

            // Validate required environment variables
            if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
                throw new Error('Missing required Firebase environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, or FIREBASE_CLIENT_EMAIL');
            }

            // Initialize Firebase Admin with specific services only - avoid Firestore
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            }, `messaging-app-${Date.now()}`); // Use unique name to avoid conflicts
            
            console.log('Firebase Admin initialized successfully with environment variables');
        }

        const userId = event.userId || event.to;
        const callSid = event.callSid;
        
        if (!userId || !callSid) {
            throw new Error('Both userId and callSid are required');
        }

        const client = context.getTwilioClient();
        const syncServiceSid = 'IS45d7824102ba723ff4fd508de46d2490';
        const identity = `store${userId}`;

        // Create pending_calls sync map if it doesn't exist
        try {
            await client.sync.services(syncServiceSid).syncMaps('pending_calls').fetch();
        } catch (e) {
            console.log('Creating pending_calls sync map...');
            await client.sync.services(syncServiceSid).syncMaps.create({uniqueName: 'pending_calls'});
        }

        // Store pending call information
        const callData = {
            callSid: callSid,
            userId: userId,
            from: event.from || 'Unknown',
            to: event.to || userId,
            status: 'notification_sent',
            pwaReady: false,
            timestamp: new Date().toISOString(),
            notificationSentAt: new Date().toISOString()
        };

        try {
            await client.sync.services(syncServiceSid)
                .syncMaps('pending_calls')
                .syncMapItems
                .create({
                    key: callSid,
                    data: callData
                });
            console.log('Pending call record created:', callSid);
        } catch (e) {
            // Update if exists
            await client.sync.services(syncServiceSid)
                .syncMaps('pending_calls')
                .syncMapItems(callSid)
                .update({
                    data: callData
                });
            console.log('Pending call record updated:', callSid);
        }

        try {
            console.log(`Fetching FCM token for identity: ${identity}`);
            const syncMapItem = await client.sync.v1
                .services(syncServiceSid)
                .syncMaps('fcm_tokens')
                .syncMapItems(identity)
                .fetch();

            const fcmToken = syncMapItem.data.fcmToken;

            if (!fcmToken) {
                throw new Error(`No FCM token found for identity: ${identity}`);
            }

            console.log(`Found FCM token for ${identity}:`, fcmToken.substring(0, 20) + '...');

            const message = {
                token: fcmToken,
                data: {
                    title: 'Incoming Call',
                    body: `Call from ${event.from || 'Unknown'}`,
                    callSid: callSid,
                    caller: event.from || 'Unknown',
                    recipient: event.to || userId,
                    userId: userId,
                    type: 'incoming_call'
                },
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

            console.log('Attempting to send Firebase message...');
            const result = await app.messaging().send(message);
            console.log('Notification sent successfully:', result);

            response.setStatusCode(200);
            response.setBody({
                success: true,
                messageId: result,
                callSid: callSid,
                fcmToken: fcmToken.substring(0, 20) + '...',
                identity: identity,
                pendingCallCreated: true
            });

        } catch (syncError) {
            console.error('Error fetching FCM token from Sync:', syncError);
            throw new Error(`Failed to get FCM token for user ${userId}: ${syncError.message}`);
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