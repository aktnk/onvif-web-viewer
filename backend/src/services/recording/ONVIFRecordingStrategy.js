const BaseRecordingStrategy = require('./BaseRecordingStrategy');
const { Cam } = require('onvif');

/**
 * Recording strategy for ONVIF cameras
 * Uses ONVIF protocol to retrieve RTSP stream URL, then records with -c:v copy (no re-encoding)
 */
class ONVIFRecordingStrategy extends BaseRecordingStrategy {
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
          console.error('[ONVIF Recording] Connection error:', err);
          return reject(err);
        }

        cam.getStreamUri({ protocol: 'RTSP' }, (err, stream) => {
          if (err) {
            console.error('[ONVIF Recording] Failed to get stream URI:', err);
            return reject(err);
          }

          const originalUrl = stream.uri;
          console.log(`[ONVIF Recording] Retrieved stream URL for camera ${camera.id}:`, originalUrl);

          // Embed credentials in RTSP URL for FFmpeg
          const url = new URL(originalUrl);
          const authenticatedRtspUrl = `rtsp://${camera.user}:${encodeURIComponent(camera.pass)}@${url.hostname}:${url.port}${url.pathname}${url.search}`;

          resolve(authenticatedRtspUrl);
        });
      });
    });
  }

  /**
   * Get FFmpeg arguments for ONVIF camera recording
   * Uses -c:v copy for low CPU usage (no re-encoding)
   * Audio is disabled (-an) to avoid codec compatibility issues with MP4
   * @param {string} inputUrl - RTSP URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    return [
      '-rtsp_transport', 'tcp',
      '-i', inputUrl,
      '-c:v', 'copy',
      '-an'  // No audio (avoid codec compatibility issues)
    ];
  }
}

module.exports = ONVIFRecordingStrategy;
