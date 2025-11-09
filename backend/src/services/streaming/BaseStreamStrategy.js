const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Base class for camera streaming strategies
 * Implements common FFmpeg process management and HLS output handling
 */
class BaseStreamStrategy {
  constructor(streamsBasePath) {
    this.streamsBasePath = streamsBasePath;
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
   * Get FFmpeg output arguments for HLS streaming
   * @param {string} outputPath - Path to HLS output directory
   * @returns {Array<string>} FFmpeg arguments for HLS output
   */
  getHLSOutputArgs(outputPath) {
    return [
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '3',
      '-hls_flags', 'delete_segments+omit_endlist',
      '-hls_segment_filename', path.join(outputPath, 'segment_%03d.ts'),
      path.join(outputPath, 'stream.m3u8')
    ];
  }

  /**
   * Prepare output directory for HLS streaming
   * @param {number} cameraId - Camera ID
   * @returns {Promise<string>} Path to output directory
   */
  async prepareOutputDir(cameraId) {
    const outputPath = path.join(this.streamsBasePath, String(cameraId));

    try {
      await fs.rm(outputPath, { recursive: true, force: true });
    } catch (err) {
      // Directory might not exist, ignore
    }

    await fs.mkdir(outputPath, { recursive: true });
    return outputPath;
  }

  /**
   * Spawn FFmpeg process for streaming
   * @param {Object} camera - Camera configuration
   * @returns {Promise<ChildProcess>} Spawned FFmpeg process
   */
  async spawnFFmpeg(camera) {
    const inputUrl = await this.getInputUrl(camera);
    const outputPath = await this.prepareOutputDir(camera.id);

    const inputArgs = this.getFFmpegInputArgs(inputUrl);
    const outputArgs = this.getHLSOutputArgs(outputPath);

    const ffmpegArgs = [
      ...inputArgs,
      ...outputArgs
    ];

    console.log(`[${this.constructor.name}] Starting FFmpeg for camera ${camera.id}:`, 'ffmpeg', ffmpegArgs.join(' '));

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`[FFmpeg stdout - ${camera.id}] ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      // FFmpeg writes progress to stderr
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        console.error(`[FFmpeg stderr - ${camera.id}] ${message}`);
      }
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg error - ${camera.id}]`, error);
    });

    return ffmpegProcess;
  }
}

module.exports = BaseStreamStrategy;
