const { Cam } = require('onvif');

/**
 * Get the current date and time from an ONVIF camera
 * @param {Object} cameraConfig - Camera configuration object
 * @param {string} cameraConfig.host - Camera IP address
 * @param {number} cameraConfig.port - Camera port (default: 80)
 * @param {string} cameraConfig.user - Camera username
 * @param {string} cameraConfig.pass - Camera password
 * @param {string} [cameraConfig.xaddr] - Optional custom ONVIF device service URL
 * @returns {Promise<Object>} Camera time information
 */
async function getCameraTime(cameraConfig) {
    return new Promise((resolve, reject) => {
        console.log(`[timeSync] Getting time from camera: ${cameraConfig.host}:${cameraConfig.port || 80}`);

        const camOptions = {
            hostname: cameraConfig.host,
            username: cameraConfig.user,
            password: cameraConfig.pass,
            port: cameraConfig.port || 80,
            timeout: 10000
        };

        if (cameraConfig.xaddr) {
            camOptions.xaddr = cameraConfig.xaddr;
        }

        const cam = new Cam(camOptions, function(err) {
            if (err) {
                console.error('[timeSync] Connection Error:', err);
                return reject(new Error(`Failed to connect to camera: ${err.message}`));
            }

            cam.getSystemDateAndTime((err, date) => {
                if (err) {
                    console.error('[timeSync] Get Time Error:', err);
                    return reject(new Error(`Failed to get camera time: ${err.message}`));
                }

                console.log('[timeSync] Camera time retrieved successfully:', date);
                resolve({
                    cameraTime: date,
                    serverTime: new Date()
                });
            });
        });
    });
}

/**
 * Synchronize camera time with server time
 * @param {Object} cameraConfig - Camera configuration object
 * @param {string} cameraConfig.host - Camera IP address
 * @param {number} cameraConfig.port - Camera port (default: 80)
 * @param {string} cameraConfig.user - Camera username
 * @param {string} cameraConfig.pass - Camera password
 * @param {string} [cameraConfig.xaddr] - Optional custom ONVIF device service URL
 * @returns {Promise<Object>} Sync result with before/after times
 */
async function syncCameraTime(cameraConfig) {
    return new Promise((resolve, reject) => {
        console.log(`[timeSync] Syncing time for camera: ${cameraConfig.host}:${cameraConfig.port || 80}`);

        const camOptions = {
            hostname: cameraConfig.host,
            username: cameraConfig.user,
            password: cameraConfig.pass,
            port: cameraConfig.port || 80,
            timeout: 10000
        };

        if (cameraConfig.xaddr) {
            camOptions.xaddr = cameraConfig.xaddr;
        }

        const cam = new Cam(camOptions, function(err) {
            if (err) {
                console.error('[timeSync] Connection Error:', err);
                return reject(new Error(`Failed to connect to camera: ${err.message}`));
            }

            // First, get the current camera time to show the difference
            cam.getSystemDateAndTime((err, beforeTime) => {
                if (err) {
                    console.error('[timeSync] Get Time Error:', err);
                    // Continue anyway, we can still set the time
                    beforeTime = null;
                }

                // Get current server time
                const now = new Date();

                // Prepare date/time parameters for ONVIF
                // The onvif library expects an options object with dateTime as a Date object
                const options = {
                    dateTimeType: 'Manual',
                    daylightSavings: false,
                    timezone: 'UTC',
                    dateTime: now
                };

                console.log('[timeSync] Setting camera time to:', now.toISOString());

                // Set the camera time
                cam.setSystemDateAndTime(options, (err) => {
                    if (err) {
                        console.error('[timeSync] Set Time Error:', err);
                        return reject(new Error(`Failed to set camera time: ${err.message}`));
                    }

                    console.log('[timeSync] Camera time synchronized successfully');
                    resolve({
                        success: true,
                        beforeTime: beforeTime,
                        serverTime: now,
                        message: 'Camera time synchronized successfully'
                    });
                });
            });
        });
    });
}

module.exports = {
    getCameraTime,
    syncCameraTime
};
