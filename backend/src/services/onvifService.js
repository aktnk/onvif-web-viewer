const { Cam } = require('onvif');

async function testConnection(cameraConfig) {
    return new Promise((resolve, reject) => {
        console.log(`[onvif] Testing connection to camera: ${cameraConfig.host}:${cameraConfig.port || 80}`);
        const cam = new Cam({
            hostname: cameraConfig.host,
            username: cameraConfig.user,
            password: cameraConfig.pass,
            port: cameraConfig.port || 80,
            timeout: 10000
        }, function(err) {
            if (err) {
                console.error('[onvif] Test Connection Error:', err);
                return reject(new Error(`[onvif] Test Connection failed: ${err.message}`));
            }
            console.log('[onvif] Test connection successful. Device info:', this.device);
            resolve({ success: true, info: this.device });
        });
    });
}

module.exports = { testConnection };
