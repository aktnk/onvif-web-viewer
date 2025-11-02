const { Cam } = require('onvif');
const BaseStreamStrategy = require('./BaseStreamStrategy');

/**
 * Streaming strategy for ONVIF cameras.
 * Uses RTSP protocol with copy codec for efficient streaming.
 */
class ONVIFStreamStrategy extends BaseStreamStrategy {
  /**
   * Retrieves the RTSP stream URL for a given ONVIF camera.
   * @param {Object} camera - The camera object from the database
   * @returns {Promise<string>} The RTSP URL
   */
  async getRtspUrl(camera) {
    return new Promise((resolve, reject) => {
      console.log(`[ONVIF] Connecting to camera: ${camera.host}:${camera.port || 80}`);

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

        console.log('[ONVIF] Connected successfully. Device info:', this.device);

        this.getStreamUri({ protocol: 'RTSP' }, (err, stream) => {
          if (err) {
            console.error('[ONVIF] getStreamUri Error:', err);
            return reject(new Error(`[ONVIF] Could not get stream URI: ${err.message}`));
          }
          if (!stream || !stream.uri) {
            console.error('[ONVIF] Stream URI response is empty. Available profiles:', this.profiles);
            return reject(new Error('[ONVIF] Stream URI is empty in the response.'));
          }
          console.log(`[ONVIF] Found RTSP URI: ${stream.uri}`);
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
    console.log(`[ONVIF] Authenticated RTSP URL for FFmpeg: ${authenticatedRtspUrl}`);

    return authenticatedRtspUrl;
  }

  /**
   * Get FFmpeg input arguments for ONVIF/RTSP streams.
   * Uses copy codec to avoid re-encoding (low CPU usage).
   * @param {string} inputUrl - Authenticated RTSP URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    return [
      '-rtsp_transport', 'tcp', // Use TCP for more reliable connection
      '-i', inputUrl,
      '-c:v', 'copy',           // Copy video codec without re-encoding
      '-c:a', 'aac'             // Re-encode audio to AAC
    ];
  }
}

module.exports = ONVIFStreamStrategy;
