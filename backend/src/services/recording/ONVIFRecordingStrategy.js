const { Cam } = require('onvif');
const BaseRecordingStrategy = require('./BaseRecordingStrategy');

/**
 * Recording strategy for ONVIF cameras.
 * Uses RTSP protocol with copy codec for efficient recording.
 */
class ONVIFRecordingStrategy extends BaseRecordingStrategy {
  /**
   * Retrieves the RTSP stream URL for a given ONVIF camera.
   * @param {Object} camera - The camera object from the database
   * @returns {Promise<string>} The RTSP URL
   */
  async getRtspUrl(camera) {
    return new Promise((resolve, reject) => {
      console.log(`[ONVIF] Connecting to camera for recording: ${camera.host}:${camera.port || 80}`);

      const camConfig = {
        hostname: camera.host,
        username: camera.user,
        password: camera.pass,
        port: camera.port || 80,
        timeout: 10000
      };

      // Add xaddr if provided (for non-standard ONVIF endpoints)
      if (camera.xaddr) {
        camConfig.xaddr = camera.xaddr;
      }

      const cam = new Cam(camConfig, function(err) {
        if (err) {
          console.error('[ONVIF] Connection Error:', err);
          return reject(new Error(`[ONVIF] Connection failed: ${err.message}`));
        }

        this.getStreamUri({ protocol: 'RTSP' }, (err, stream) => {
          if (err) {
            return reject(new Error(`[ONVIF] Could not get stream URI: ${err.message}`));
          }
          if (!stream || !stream.uri) {
            return reject(new Error('[ONVIF] Stream URI is empty in the response.'));
          }
          resolve(stream.uri);
        });
      });
    });
  }

  /**
   * Get input URL with embedded credentials for FFmpeg.
   * @param {Object} camera - Camera object from database
   * @returns {Promise<string>} Authenticated RTSP URL
   */
  async getInputUrl(camera) {
    const originalUrl = await this.getRtspUrl(camera);

    // Use URL object to safely parse and then manually reconstruct the URL
    const url = new URL(originalUrl);
    const authenticatedRtspUrl = `rtsp://${camera.user}:${encodeURIComponent(camera.pass)}@${url.hostname}:${url.port}${url.pathname}${url.search}`;
    console.log(`[ONVIF] Authenticated RTSP URL for recording: ${authenticatedRtspUrl}`);

    return authenticatedRtspUrl;
  }

  /**
   * Get FFmpeg input arguments for ONVIF/RTSP recording.
   * Uses copy codec to avoid re-encoding (low CPU usage).
   * @param {string} inputUrl - Authenticated RTSP URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    return [
      '-rtsp_transport', 'tcp',
      '-i', inputUrl,
      '-c:v', 'copy', // Copy video stream without re-encoding
      '-c:a', 'copy',   // Attempt to copy audio stream
      '-an'           // Disable audio recording if copying fails or no audio stream exists
    ];
  }
}

module.exports = ONVIFRecordingStrategy;
