const BaseStreamStrategy = require('./BaseStreamStrategy');

/**
 * Streaming strategy for generic RTSP cameras
 * Supports any RTSP source (IP cameras, MediaMTX, etc.)
 * Uses libx264 re-encoding with proper keyframe interval for HLS compatibility
 */
class RTSPStreamStrategy extends BaseStreamStrategy {
  /**
   * Build RTSP URL from camera configuration
   * @param {Object} camera - Camera with host, port, user, pass, stream_path
   * @returns {Promise<string>} RTSP URL
   */
  async getInputUrl(camera) {
    if (!camera.host || !camera.port) {
      throw new Error('[RTSP] Host and port are required for RTSP cameras');
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

    console.log(`[RTSP] Constructed stream URL for camera ${camera.id}:`, rtspUrl.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
    return rtspUrl;
  }

  /**
   * Get FFmpeg arguments for RTSP camera streaming
   * Uses libx264 re-encoding with -g 30 to ensure proper keyframe intervals for HLS
   * This prevents frozen video issues in HLS players
   * @param {string} inputUrl - RTSP URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    return [
      '-rtsp_transport', 'tcp',
      '-i', inputUrl,
      '-c:v', 'libx264',
      '-preset', 'veryfast',  // Fast encoding for low latency
      '-b:v', '2000k',        // 2 Mbps video bitrate
      '-g', '30',             // Keyframe every 30 frames (1 sec at 30fps) for HLS
      '-an'                   // No audio
    ];
  }
}

module.exports = RTSPStreamStrategy;
