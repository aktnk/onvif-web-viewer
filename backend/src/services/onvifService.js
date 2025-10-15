const onvif = require('node-onvif');

async function testConnection(cameraConfig) {
    const device = new onvif.OnvifDevice({
      xaddr: `http://${cameraConfig.host}:${cameraConfig.port || 80}/onvif/device_service`,
      user: cameraConfig.user,
      pass: cameraConfig.pass
    });

    try {
        const info = await device.init();
        console.log(`Successfully connected to ${cameraConfig.host}`);
        return { success: true, info: info };
    } catch (error) {
        console.error(`Failed to connect to ${cameraConfig.host}:`, error.message);
        // Re-throw a more specific error to be caught by the API layer
        throw new Error(`Failed to connect: ${error.message}`);
    }
}

module.exports = { testConnection };
