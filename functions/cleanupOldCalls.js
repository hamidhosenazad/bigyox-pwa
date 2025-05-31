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
        console.log('Starting cleanup of old call records...');

        const client = context.getTwilioClient();
        const syncServiceSid = 'IS45d7824102ba723ff4fd508de46d2490';

        // Get all items from pending_calls map
        try {
            const syncMapItems = await client.sync.services(syncServiceSid)
                .syncMaps('pending_calls')
                .syncMapItems
                .list();

            const currentTime = new Date();
            const maxAgeMinutes = event.maxAgeMinutes || 30; // Default to 30 minutes
            let cleanupCount = 0;

            console.log(`Found ${syncMapItems.length} call records to check`);

            for (const item of syncMapItems) {
                const callData = item.data;
                const callTime = new Date(callData.timestamp);
                const ageMinutes = (currentTime - callTime) / (1000 * 60);

                console.log(`Call ${item.key}: age = ${ageMinutes.toFixed(1)} minutes, status = ${callData.status}`);

                // Remove calls older than maxAgeMinutes or already transferred
                if (ageMinutes > maxAgeMinutes || callData.status === 'transferred' || callData.status === 'completed') {
                    try {
                        await client.sync.services(syncServiceSid)
                            .syncMaps('pending_calls')
                            .syncMapItems(item.key)
                            .remove();
                        
                        cleanupCount++;
                        console.log(`Cleaned up call record: ${item.key}`);
                    } catch (deleteError) {
                        console.warn(`Failed to delete call record ${item.key}:`, deleteError);
                    }
                }
            }

            response.setBody({
                success: true,
                totalRecords: syncMapItems.length,
                cleanedUp: cleanupCount,
                maxAgeMinutes: maxAgeMinutes,
                message: `Cleaned up ${cleanupCount} old call records`
            });

        } catch (syncError) {
            if (syncError.status === 404) {
                // Map doesn't exist yet
                response.setBody({
                    success: true,
                    message: 'No pending_calls map found - nothing to clean up'
                });
            } else {
                throw syncError;
            }
        }

    } catch (error) {
        console.error('Error during cleanup:', error);
        response.setStatusCode(500);
        response.setBody({
            success: false,
            error: error.message
        });
    }

    callback(null, response);
}; 