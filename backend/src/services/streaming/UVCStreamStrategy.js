const fs = require('fs');
const BaseStreamStrategy = require('./BaseStreamStrategy');

/**
 * Streaming strategy for UVC (USB Video Class) cameras.
 * Uses V4L2 (Video4Linux2) input with libx264 encoding.
 */
class UVCStreamStrategy extends BaseStreamStrategy {
  /**
   * Get input URL (device path) for UVC camera.
   * @param {Object} camera - Camera object from database
   * @returns {Promise<string>} Device path (e.g., /dev/video0)
   */
  async getInputUrl(camera) {
    const devicePath = camera.device_path;

    // Verify device exists
    if (!fs.existsSync(devicePath)) {
      throw new Error(`UVC device ${devicePath} not found. Please check if the camera is connected.`);
    }

    console.log(`[UVC] Using device: ${devicePath}`);
    return devicePath;
  }

  /**
   * Get FFmpeg input arguments for UVC/V4L2 devices.
   * Requires re-encoding with libx264 (CPU intensive).
   * @param {string} inputUrl - Device path
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    return [
      '-f', 'v4l2',             // Video4Linux2 input format
      '-i', inputUrl,           // Device path (e.g., /dev/video0)
      '-c:v', 'libx264',        // Encode to H.264 (required for UVC)
      '-preset', 'ultrafast',   // Fastest encoding preset for low latency
      '-tune', 'zerolatency',   // Optimize for low latency streaming
      '-an'                     // Disable audio (most UVC cameras don't have audio)
    ];
  }
}

module.exports = UVCStreamStrategy;
