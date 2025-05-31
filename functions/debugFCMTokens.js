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

        const client = context.getTwilioClient();
        const syncServiceSid = 'IS45d7824102ba723ff4fd508de46d2490';

        console.log('Fetching all FCM tokens from Sync...');

        try {
            // List all items in the fcm_tokens map
            const syncMapItems = await client.sync.v1
                .services(syncServiceSid)
                .syncMaps('fcm_tokens')
                .syncMapItems
                .list();

            const tokens = syncMapItems.map(item => ({
                identity: item.key,
                userId: item.key.replace('store', ''),
                fcmToken: item.data.fcmToken ? item.data.fcmToken.substring(0, 20) + '...' : 'no token',
                platform: item.data.platform || 'unknown',
                lastUpdated: item.dateUpdated,
                data: item.data
            }));

            console.log(`Found ${tokens.length} FCM tokens in Sync`);

            response.setStatusCode(200);
            response.setBody({
                success: true,
                totalTokens: tokens.length,
                tokens: tokens
            });

        } catch (syncError) {
            console.error('Error fetching FCM tokens from Sync:', syncError);
            
            // If the map doesn't exist, create it
            if (syncError.code === 20404) {
                console.log('FCM tokens map does not exist, creating it...');
                await client.sync.v1
                    .services(syncServiceSid)
                    .syncMaps
                    .create({ uniqueName: 'fcm_tokens' });

                response.setStatusCode(200);
                response.setBody({
                    success: true,
                    message: 'FCM tokens map created (was empty)',
                    totalTokens: 0,
                    tokens: []
                });
            } else {
                throw syncError;
            }
        }

    } catch (error) {
        console.error('Debug FCM tokens error:', error);
        response.setStatusCode(500);
        response.setBody({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }

    return callback(null, response);
}; 