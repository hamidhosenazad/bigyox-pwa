exports.handler = function(context, event, callback) {
    const response = new Twilio.Response();
    response.appendHeader('Access-Control-Allow-Origin', '*');
    response.appendHeader('Content-Type', 'application/json');

    try {
        console.log('Testing asset loading...');
        
        // List all available assets
        const assets = Runtime.getAssets();
        console.log('Available assets:', Object.keys(assets));
        
        // Try to load service account asset
        const assetNames = ['/service-account.json', '/firebase-service-account.json'];
        let assetFound = false;
        let assetContent = null;
        
        for (const assetName of assetNames) {
            try {
                const asset = assets[assetName];
                if (asset) {
                    console.log(`Found asset ${assetName}:`, { path: asset.path, open: typeof asset.open });
                    if (asset.path) {
                        // Use the correct method to read JSON assets
                        const fileContent = asset.open().read();
                        assetContent = JSON.parse(fileContent);
                        assetFound = true;
                        console.log('Successfully loaded and parsed asset content');
                        break;
                    }
                }
            } catch (err) {
                console.log(`Failed to load ${assetName}:`, err.message);
            }
        }
        
        response.setBody({
            success: true,
            assetsFound: Object.keys(assets),
            serviceAccountFound: assetFound,
            hasPrivateKey: assetContent ? !!assetContent.private_key : false,
            projectId: assetContent ? assetContent.project_id : null
        });
        
    } catch (error) {
        console.error('Error testing asset:', error);
        response.setBody({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
    
    callback(null, response);
}; 