exports.handler = async function (context, event, callback) {
    const response = new Twilio.Response();
    response.appendHeader('Access-Control-Allow-Origin', '*');
    response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.appendHeader('Content-Type', 'application/json');

    const client = context.getTwilioClient();

    const { callSid, extension } = event;

    // Add logging for debugging
    console.log('Transfer request received:', {
        callSid,
        extension
    });

    if (!callSid || !extension) {
        response.setBody({ error: 'Missing callSid or extension' });
        return callback(null, response);
    }

    try {
        // Get call details to check the origin
        const call = await client.calls(callSid).fetch();
        console.log('Call details:', {
            from: call.from,
            to: call.to,
            status: call.status,
            fromCountry: call.fromCountry
        });

        const twiml = new Twilio.twiml.VoiceResponse();
        
        // Add a pause for connection stability
        twiml.pause({ length: 1 });
        
        // Set up the dial with specific parameters for better EU routing
        twiml.dial({
            callerId: call.to, // Use the Flex number as caller ID
            region: 'eu1'     // Specify EU region
        }).client(`store${extension}`, {
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallback: `https://${context.DOMAIN_NAME}/status-callback`
        });

        console.log('Generated TwiML:', twiml.toString());

        await client.calls(callSid).update({
            twiml: twiml.toString()
        });

        response.setBody({ 
            success: true,
            callDetails: {
                from: call.from,
                to: call.to,
                status: call.status
            }
        });
        return callback(null, response);
    } catch (err) {
        console.error('Error in transfer:', err);
        response.setStatusCode(500);
        response.setBody({ 
            error: err.message,
            details: err.details || 'No additional details'
        });
        return callback(null, response);
    }
}; 