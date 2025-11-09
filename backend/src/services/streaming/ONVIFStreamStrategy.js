const BaseStreamStrategy = require('./BaseStreamStrategy');
const { Cam } = require('onvif');

/**
 * Streaming strategy for ONVIF cameras
 * Uses ONVIF protocol to retrieve RTSP stream URL, then streams with -c:v copy (no re-encoding)
 */
class ONVIFStreamStrategy extends BaseStreamStrategy {
  /**
   * Get RTSP stream URL from ONVIF camera
   * @param {Object} camera - Camera with host, port, user, pass, xaddr
   * @returns {Promise<string>} RTSP URL
   */
  async getInputUrl(camera) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: camera.host,
        port: camera.port || 80,
        username: camera.user,
        password: camera.pass
      };

      if (camera.xaddr) {
        options.xaddr = camera.xaddr;
      }

      const cam = new Cam(options, (err) => {
        if (err) {
          console.error('[ONVIF] Connection error:', err);
          return reject(err);
        }

        cam.getStreamUri({ protocol: 'RTSP' }, (err, stream) => {
          if (err) {
            console.error('[ONVIF] Failed to get stream URI:', err);
            return reject(err);
          }

          const originalUrl = stream.uri;
          console.log(`[ONVIF] Retrieved stream URL for camera ${camera.id}:`, originalUrl);

          // Embed credentials in RTSP URL for FFmpeg
          const url = new URL(originalUrl);
          const authenticatedRtspUrl = `rtsp://${camera.user}:${encodeURIComponent(camera.pass)}@${url.hostname}:${url.port}${url.pathname}${url.search}`;

          resolve(authenticatedRtspUrl);
        });
      });
    });
  }

  /**
   * Get FFmpeg arguments for ONVIF camera streaming
   * Uses -c:v copy for low CPU usage (no re-encoding)
   * @param {string} inputUrl - RTSP URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    return [
      '-rtsp_transport', 'tcp',
      '-i', inputUrl,
      '-c:v', 'copy',
      '-an'  // No audio
    ];
  }
}

module.exports = ONVIFStreamStrategy;
