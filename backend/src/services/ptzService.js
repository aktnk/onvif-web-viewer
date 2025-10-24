const { Cam } = require('onvif');

/**
 * Check if a camera has PTZ capabilities
 * @param {Object} cameraConfig - Camera configuration object
 * @param {string} cameraConfig.host - Camera IP address
 * @param {number} cameraConfig.port - Camera port (default: 80)
 * @param {string} cameraConfig.user - Camera username
 * @param {string} cameraConfig.pass - Camera password
 * @param {string} [cameraConfig.xaddr] - Optional custom ONVIF device service URL
 * @returns {Promise<Object>} PTZ capability information
 */
async function checkPTZCapability(cameraConfig) {
    return new Promise((resolve, reject) => {
        console.log(`[PTZ] Checking PTZ capability for camera: ${cameraConfig.host}:${cameraConfig.port || 80}`);

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
                console.error('[PTZ] Connection Error:', err);
                return reject(new Error(`Failed to connect to camera: ${err.message}`));
            }

            // Explicitly get capabilities if not already loaded
            this.getCapabilities((err, capabilities) => {
                if (err) {
                    console.error('[PTZ] GetCapabilities Error:', err);
                    // Continue anyway, as some cameras might still have PTZ
                }

                console.log('[PTZ] Capabilities:', {
                    capabilities: this.capabilities,
                    activeSource: this.activeSource,
                    defaultProfile: this.defaultProfile
                });

                // Check multiple ways to detect PTZ
                const hasPTZCapability = !!(this.capabilities && this.capabilities.PTZ && this.capabilities.PTZ.XAddr);
                const hasPTZProfile = !!(this.activeSource && this.activeSource.ptz);
                const hasDefaultProfilePTZ = !!(this.defaultProfile && this.defaultProfile.PTZConfiguration);

                const ptzEnabled = hasPTZCapability || hasPTZProfile || hasDefaultProfilePTZ;

                console.log('[PTZ] Capability check result:', {
                    hasPTZCapability,
                    hasPTZProfile,
                    hasDefaultProfilePTZ,
                    ptzEnabled
                });

                resolve({
                    supported: ptzEnabled,
                    capabilities: ptzEnabled ? {
                        hasPanTilt: true,
                        hasZoom: true
                    } : null
                });
            });
        });
    });
}

/**
 * Move camera using continuous PTZ movement
 * @param {Object} cameraConfig - Camera configuration object
 * @param {Object} movement - Movement parameters
 * @param {number} movement.x - Pan speed (-1.0 to 1.0, negative=left, positive=right)
 * @param {number} movement.y - Tilt speed (-1.0 to 1.0, negative=down, positive=up)
 * @param {number} movement.zoom - Zoom speed (-1.0 to 1.0, negative=out, positive=in)
 * @param {number} [movement.timeout] - Optional timeout in milliseconds
 * @returns {Promise<Object>} Movement result
 */
async function movePTZ(cameraConfig, movement) {
    return new Promise((resolve, reject) => {
        console.log(`[PTZ] Moving camera: ${cameraConfig.host}`, movement);

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
                console.error('[PTZ] Connection Error:', err);
                return reject(new Error(`Failed to connect to camera: ${err.message}`));
            }

            const moveOptions = {
                x: movement.x || 0,
                y: movement.y || 0,
                zoom: movement.zoom || 0
            };

            if (movement.timeout) {
                moveOptions.timeout = movement.timeout;
            }

            this.continuousMove(moveOptions, (err) => {
                if (err) {
                    console.error('[PTZ] Move Error:', err);
                    return reject(new Error(`Failed to move camera: ${err.message}`));
                }

                console.log('[PTZ] Camera movement started successfully');
                resolve({
                    success: true,
                    message: 'Camera movement started'
                });
            });
        });
    });
}

/**
 * Stop PTZ movement
 * @param {Object} cameraConfig - Camera configuration object
 * @param {Object} [options] - Stop options
 * @param {boolean} [options.panTilt=true] - Stop pan/tilt movement
 * @param {boolean} [options.zoom=true] - Stop zoom movement
 * @returns {Promise<Object>} Stop result
 */
async function stopPTZ(cameraConfig, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`[PTZ] Stopping camera: ${cameraConfig.host}`);

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
                console.error('[PTZ] Connection Error:', err);
                return reject(new Error(`Failed to connect to camera: ${err.message}`));
            }

            const stopOptions = {
                panTilt: options.panTilt !== false,
                zoom: options.zoom !== false
            };

            this.stop(stopOptions, (err) => {
                if (err) {
                    console.error('[PTZ] Stop Error:', err);
                    return reject(new Error(`Failed to stop camera: ${err.message}`));
                }

                console.log('[PTZ] Camera movement stopped successfully');
                resolve({
                    success: true,
                    message: 'Camera movement stopped'
                });
            });
        });
    });
}

module.exports = {
    checkPTZCapability,
    movePTZ,
    stopPTZ
};
