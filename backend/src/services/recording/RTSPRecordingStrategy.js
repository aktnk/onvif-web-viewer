const BaseRecordingStrategy = require('./BaseRecordingStrategy');

/**
 * Recording strategy for generic RTSP cameras
 * Supports any RTSP source (IP cameras, MediaMTX, etc.)
 * Uses -c:v copy for low CPU usage during recording
 */
class RTSPRecordingStrategy extends BaseRecordingStrategy {
  /**
   * Build RTSP URL from camera configuration
   * @param {Object} camera - Camera with host, port, user, pass, stream_path
   * @returns {Promise<string>} RTSP URL
   */
  async getInputUrl(camera) {
    if (!camera.host || !camera.port) {
      throw new Error('[RTSP Recording] Host and port are required for RTSP cameras');
    }

    let rtspUrl = 'rtsp://';

    // Add credentials if provided
    if (camera.user && camera.pass) {
      rtspUrl += `${camera.user}:${encodeURIComponent(camera.pass)}@`;
    }

    rtspUrl += `${camera.host}:${camera.port}`;

    // Add stream path (default to '/' if not specified)
    const streamPath = camera.stream_path || '/';
    if (!streamPath.startsWith('/')) {
      rtspUrl += '/';
    }
    rtspUrl += streamPath;

    console.log(`[RTSP Recording] Constructed stream URL for camera ${camera.id}:`, rtspUrl.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
    return rtspUrl;
  }

  /**
   * Get FFmpeg arguments for RTSP camera recording
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

module.exports = RTSPRecordingStrategy;
