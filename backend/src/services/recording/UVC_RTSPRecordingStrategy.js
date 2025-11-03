const BaseRecordingStrategy = require('./BaseRecordingStrategy');

/**
 * Recording strategy for UVC cameras accessed via RTSP server.
 *
 * This strategy is used when a UVC (USB Video Class) camera is connected to an
 * intermediate RTSP server (e.g., MediaMTX, GStreamer rtsp-server, etc.).
 *
 * Benefits over direct V4L2 access:
 * - Allows simultaneous streaming and recording (no V4L2 device exclusivity)
 * - Lower CPU usage (no re-encoding with -c:v copy)
 * - Network transparency (RTSP stream can be accessed from multiple clients)
 *
 * Requirements:
 * - RTSP server must be configured to stream from the UVC device
 * - Camera credentials in database: host, port, user (optional), pass (optional)
 */
class UVC_RTSPRecordingStrategy extends BaseRecordingStrategy {
  /**
   * Constructs the RTSP URL for a UVC camera served by an RTSP server.
   *
   * Unlike ONVIF cameras, we don't need to query the device for the stream URI.
   * The URL is directly constructed from the camera configuration stored in the database.
   *
   * @param {Object} camera - Camera object from database
   * @param {string} camera.host - RTSP server hostname/IP
   * @param {number} camera.port - RTSP server port (typically 8554 for MediaMTX)
   * @param {string} [camera.user] - Optional RTSP authentication username
   * @param {string} [camera.pass] - Optional RTSP authentication password
   * @param {string} [camera.device_path] - Original UVC device path (for reference only)
   * @returns {Promise<string>} Authenticated RTSP URL
   */
  async getInputUrl(camera) {
    console.log(`[UVC_RTSP] Constructing RTSP URL for recording: ${camera.name}`);

    // Validate required fields
    if (!camera.host) {
      throw new Error('[UVC_RTSP] Camera host is required');
    }
    if (!camera.port) {
      throw new Error('[UVC_RTSP] Camera port is required');
    }

    // Construct base URL
    let rtspUrl = 'rtsp://';

    // Add authentication if provided
    if (camera.user && camera.pass) {
      rtspUrl += `${camera.user}:${encodeURIComponent(camera.pass)}@`;
    } else if (camera.user) {
      rtspUrl += `${camera.user}@`;
    }

    // Add host and port
    rtspUrl += `${camera.host}:${camera.port}`;

    // Add path - use fixed path for MediaMTX UVC camera
    // MediaMTX is configured with a single UVC camera at /uvc_camera_1
    const streamPath = camera.stream_path || '/uvc_camera_1';
    rtspUrl += streamPath;

    console.log(`[UVC_RTSP] Constructed RTSP URL for recording: ${rtspUrl.replace(/:[^:@]+@/, ':***@')}`);

    return rtspUrl;
  }

  /**
   * Get FFmpeg input arguments for UVC cameras via RTSP.
   *
   * Uses copy codec to avoid re-encoding, similar to ONVIF cameras.
   * This is possible because the RTSP server already handles the encoding
   * from the UVC device (V4L2 → H.264).
   *
   * @param {string} inputUrl - Authenticated RTSP URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    return [
      '-rtsp_transport', 'tcp', // Use TCP for more reliable connection
      '-i', inputUrl,
      '-c:v', 'copy',           // Copy video stream without re-encoding (low CPU)
      '-c:a', 'copy',           // Attempt to copy audio stream
      '-an'                     // Disable audio if copying fails or no audio exists
    ];
  }
}

module.exports = UVC_RTSPRecordingStrategy;
