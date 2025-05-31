exports.handler = async function(context, event, callback) {
    const response = new Twilio.Response();
    
    // Set CORS headers
    response.appendHeader('Access-Control-Allow-Origin', '*');
    response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.appendHeader('Content-Type', 'application/json');

    // Handle OPTIONS request
    if (event.request && event.request.method === 'OPTIONS') {
        callback(null, response);
        return;
    }

    try {
        const { callSid } = event;

        if (!callSid) {
            throw new Error('callSid is required');
        }

        console.log(`Checking PWA readiness for callSid: ${callSid}`);

        const client = context.getTwilioClient();
        const syncServiceSid = 'IS45d7824102ba723ff4fd508de46d2490';

        try {
            const syncMapItem = await client.sync.services(syncServiceSid)
                .syncMaps('pending_calls')
                .syncMapItems(callSid)
                .fetch();

            const callData = syncMapItem.data;
            const currentTime = new Date();
            const notificationTime = new Date(callData.notificationSentAt);
            const timeSinceNotification = (currentTime - notificationTime) / 1000; // seconds

            console.log(`Call data for ${callSid}:`, callData);
            console.log(`Time since notification: ${timeSinceNotification} seconds`);

            response.setBody({
                success: true,
                callSid: callSid,
                pwaReady: callData.pwaReady || false,
                status: callData.status,
                timeSinceNotification: timeSinceNotification,
                callData: callData
            });

        } catch (syncError) {
            console.error('Error checking call readiness:', syncError);
            
            if (syncError.status === 404) {
                response.setBody({
                    success: false,
                    error: 'Call record not found',
                    callSid: callSid,
                    pwaReady: false
                });
            } else {
                throw syncError;
            }
        }

    } catch (error) {
        console.error('Error checking PWA readiness:', error);
        response.setStatusCode(400);
        response.setBody({
            success: false,
            error: error.message
        });
    }

    callback(null, response);
}; 