const { spawn } = require('child_process');
const path = require('path');

/**
 * Base class for camera recording strategies
 * Implements common FFmpeg process management and MP4 output handling
 */
class BaseRecordingStrategy {
  constructor(recordingsBasePath) {
    this.recordingsBasePath = recordingsBasePath;
  }

  /**
   * Get the input URL/path for the camera
   * Must be implemented by subclasses
   * @param {Object} camera - Camera configuration from database
   * @returns {Promise<string>} Input URL or device path
   */
  async getInputUrl(camera) {
    throw new Error('getInputUrl() must be implemented by subclass');
  }

  /**
   * Get FFmpeg input arguments for this camera type
   * Must be implemented by subclasses
   * @param {string} inputUrl - The input URL returned by getInputUrl()
   * @returns {Array<string>} FFmpeg arguments for input
   */
  getFFmpegInputArgs(inputUrl) {
    throw new Error('getFFmpegInputArgs() must be implemented by subclass');
  }

  /**
   * Get FFmpeg output arguments for MP4 recording
   * @param {string} outputFile - Path to output MP4 file
   * @returns {Array<string>} FFmpeg arguments for MP4 output
   */
  getMP4OutputArgs(outputFile) {
    return [
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov',  // Ensure MP4 is recoverable if interrupted
      outputFile
    ];
  }

  /**
   * Generate output filename for recording
   * @param {number} cameraId - Camera ID
   * @returns {string} Full path to output file
   */
  getOutputFilename(cameraId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `camera_${cameraId}_${timestamp}.mp4`;
    return path.join(this.recordingsBasePath, filename);
  }

  /**
   * Spawn FFmpeg process for recording
   * @param {Object} camera - Camera configuration
   * @returns {Promise<{process: ChildProcess, filename: string}>} FFmpeg process and output filename
   */
  async spawnFFmpeg(camera) {
    const inputUrl = await this.getInputUrl(camera);
    const outputFile = this.getOutputFilename(camera.id);

    const inputArgs = this.getFFmpegInputArgs(inputUrl);
    const outputArgs = this.getMP4OutputArgs(outputFile);

    const ffmpegArgs = [
      ...inputArgs,
      ...outputArgs
    ];

    console.log(`[${this.constructor.name}] Starting FFmpeg recording for camera ${camera.id}:`, 'ffmpeg', ffmpegArgs.join(' '));

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`[FFmpeg recording stdout - ${camera.id}] ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      // FFmpeg writes progress to stderr
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        console.error(`[FFmpeg recording stderr - ${camera.id}] ${message}`);
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg recording error - ${camera.id}]`, error);
    });

    return { process: ffmpegProcess, filename: path.basename(outputFile) };
  }
}

module.exports = BaseRecordingStrategy;
