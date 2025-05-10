exports.handler = function(context, event, callback) {
    const AccessToken = require('twilio').jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const response = new Twilio.Response();

    response.appendHeader('Access-Control-Allow-Origin', '*');
    response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.appendHeader('Content-Type', 'application/json');

    try {
        console.log('Credentials request received:', {
            userId: event.userId,
            environment: context.DOMAIN_NAME
        });

        // Check if userId is provided
        if (!event.userId) {
            console.error('Missing userId in request');
            response.setStatusCode(400);
            response.setBody({ error: 'User ID is required' });
            return callback(null, response);
        }

        const identity = `store${event.userId}`;

        // Create a Voice grant with EU-specific configuration
        const voiceGrant = new VoiceGrant({
            incomingAllow: true,
            outgoingApplicationSid: context.APPLICATION_SID,
            // Add EU-specific voice configuration
            emergencyCallingEnabled: false,
            // Specify preferred codecs for better voice quality
            preferredAudioCodecs: ['PCMU', 'opus'],
            // Enable enhanced features
            persistentConnection: true
        });

        // Create an access token with EU region specification
        const token = new AccessToken(
            context.ACCOUNT_SID,
            context.API_KEY,
            context.API_SECRET,
            { 
                identity: identity,
                ttl: 3600,
                region: 'eu1' // Specify EU region
            }
        );

        // Add the voice grant to the token
        token.addGrant(voiceGrant);

        // Serialize the token as a JWT
        const jwt = token.toJwt();

        console.log('Generated token details:', {
            identity: identity,
            region: 'eu1',
            ttl: 3600
        });

        response.setBody({
            token: jwt,
            identity: identity,
            region: 'eu1',
            // Add additional configuration for the client
            configuration: {
                edge: ['frankfurt', 'dublin', 'ashburn'],
                codecPreferences: ['PCMU', 'opus'],
                enableIceRestart: true,
                enableRingingState: true,
                closeProtection: true
            }
        });

        return callback(null, response);
    } catch (err) {
        console.error('Error generating token:', {
            error: err.message,
            stack: err.stack,
            code: err.code
        });
        response.setStatusCode(500);
        response.setBody({ 
            error: err.message,
            details: err.details || 'No additional details'
        });
        return callback(null, response);
    }
}; 