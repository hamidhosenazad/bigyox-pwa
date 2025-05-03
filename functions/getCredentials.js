exports.handler = function(context, event, callback) {
    const AccessToken = require('twilio').jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const response = new Twilio.Response();

    response.appendHeader('Access-Control-Allow-Origin', '*');
    response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.appendHeader('Content-Type', 'application/json');

    try {
        console.log('Received request with event:', event);
        
        // Check if userId is provided
        if (!event.userId) {
            console.error('No userId provided in request');
            response.setStatusCode(400);
            response.setBody({ error: 'User ID is required' });
            return callback(null, response);
        }

        console.log('Generating token for userId:', event.userId);
        const identity = `store${event.userId}`;

        // Create a Voice grant
        const voiceGrant = new VoiceGrant({
            incomingAllow: true,
            outgoingApplicationSid: context.APPLICATION_SID
        });

        // Create an access token
        const token = new AccessToken(
            context.ACCOUNT_SID,
            context.API_KEY,
            context.API_SECRET,
            { identity: identity, ttl: 3600 }
        );

        // Add the voice grant to the token
        token.addGrant(voiceGrant);

        // Serialize the token as a JWT
        const jwt = token.toJwt();

        console.log(`Generated token for ${identity}`);

        response.setBody({
            token: jwt,
            identity: identity,
        });

        callback(null, response);
    } catch (err) {
        console.error('Error generating token:', err);
        response.setStatusCode(500);
        response.setBody({ error: err.message });
        callback(null, response);
    }
}; 