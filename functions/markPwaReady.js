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
        const { callSid, userId, status } = event;

        if (!callSid) {
            throw new Error('callSid is required');
        }

        console.log(`Marking PWA ready for callSid: ${callSid}, userId: ${userId}, status: ${status}`);

        const client = context.getTwilioClient();
        const syncServiceSid = 'IS45d7824102ba723ff4fd508de46d2490';

        // Fetch current call data
        try {
            const syncMapItem = await client.sync.services(syncServiceSid)
                .syncMaps('pending_calls')
                .syncMapItems(callSid)
                .fetch();

            const callData = syncMapItem.data;
            
            // Update with PWA ready status
            const updatedData = {
                ...callData,
                pwaReady: true,
                pwaReadyAt: new Date().toISOString(),
                status: status || 'pwa_ready'
            };

            await client.sync.services(syncServiceSid)
                .syncMaps('pending_calls')
                .syncMapItems(callSid)
                .update({
                    data: updatedData
                });

            console.log(`PWA marked as ready for call ${callSid}`);

            response.setBody({
                success: true,
                callSid: callSid,
                pwaReady: true,
                message: 'PWA marked as ready for call transfer'
            });

        } catch (syncError) {
            console.error('Error updating call readiness:', syncError);
            
            // If call record doesn't exist, it might have been cleaned up or call ended
            if (syncError.status === 404) {
                response.setBody({
                    success: false,
                    error: 'Call record not found - call may have ended or been transferred',
                    callSid: callSid
                });
            } else {
                throw syncError;
            }
        }

    } catch (error) {
        console.error('Error marking PWA ready:', error);
        response.setStatusCode(400);
        response.setBody({
            success: false,
            error: error.message
        });
    }

    callback(null, response);
}; 