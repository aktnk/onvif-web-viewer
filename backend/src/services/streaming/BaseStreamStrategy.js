const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Base class for streaming strategies.
 * Provides common FFmpeg process management and HLS output configuration.
 */
class BaseStreamStrategy {
  constructor(streamsBasePath) {
    this.streamsBasePath = streamsBasePath;
  }

  /**
   * Get input URL for the camera.
   * Must be implemented by subclasses.
   * @param {Object} camera - Camera object from database
   * @returns {Promise<string>} Input URL for FFmpeg
   */
  async getInputUrl(camera) {
    throw new Error('getInputUrl() must be implemented by subclass');
  }

  /**
   * Get FFmpeg input arguments.
   * Must be implemented by subclasses.
   * @param {string} inputUrl - Input URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    throw new Error('getFFmpegInputArgs() must be implemented by subclass');
  }

  /**
   * Get common HLS output arguments.
   * @param {string} outputPath - Path to output m3u8 file
   * @returns {Array<string>} FFmpeg output arguments
   */
  getHLSOutputArgs(outputPath) {
    return [
      '-f', 'hls',
      '-hls_time', '2',         // 2-second segments
      '-hls_list_size', '5',    // Keep 5 segments in the playlist
      '-hls_flags', 'delete_segments+independent_segments', // Delete old segments and create independent segments
      '-hls_segment_type', 'mpegts', // Use MPEG-TS format for segments
      '-hls_init_time', '1',    // Try to create initial segment quickly (1 second)
      '-start_number', '0',     // Start segment numbering from 0
      '-g', '30',               // GOP size (keyframe interval) - adjust based on framerate
      '-sc_threshold', '0',     // Disable scene change detection for consistent segments
      outputPath
    ];
  }

  /**
   * Spawn FFmpeg process with common management logic.
   * @param {number} cameraId - Camera ID
   * @param {Array<string>} args - Complete FFmpeg arguments
   * @param {string} outputDir - Output directory for HLS files
   * @param {Map} activeStreams - Map to track active processes
   * @returns {ChildProcess} Spawned FFmpeg process
   */
  spawnFFmpeg(cameraId, args, outputDir, activeStreams) {
    console.log(`Spawning FFmpeg for camera ${cameraId}: ffmpeg ${args.join(' ')}`);
    const ffmpegProcess = spawn('ffmpeg', args);
    activeStreams.set(cameraId, ffmpegProcess);

    ffmpegProcess.stderr.on('data', (data) => {
      // FFmpeg logs progress to stderr
      console.log(`FFMPEG (cam-${cameraId}): ${data}`);
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process for camera ${cameraId} exited with code ${code}`);
      activeStreams.delete(cameraId);
      // Clean up the directory on exit
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`Failed to start FFmpeg for camera ${cameraId}:`, err);
      activeStreams.delete(cameraId);
    });

    return ffmpegProcess;
  }

  /**
   * Prepare output directory for streaming.
   * @param {number} cameraId - Camera ID
   * @returns {string} Output directory path
   */
  prepareOutputDir(cameraId) {
    const outputDir = path.join(this.streamsBasePath, String(cameraId));

    // Clean up directory from any previous session
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    return outputDir;
  }

  /**
   * Start streaming for a camera.
   * Template method that orchestrates the streaming setup.
   * @param {Object} camera - Camera object from database
   * @param {number} cameraId - Camera ID
   * @param {Map} activeStreams - Map to track active processes
   * @returns {Promise<Object>} Object containing streamUrl
   */
  async startStream(camera, cameraId, activeStreams) {
    const inputUrl = await this.getInputUrl(camera);
    const outputDir = this.prepareOutputDir(cameraId);
    const outputPath = path.join(outputDir, 'index.m3u8');

    const inputArgs = this.getFFmpegInputArgs(inputUrl);
    const outputArgs = this.getHLSOutputArgs(outputPath);
    const ffmpegArgs = [...inputArgs, ...outputArgs];

    this.spawnFFmpeg(cameraId, ffmpegArgs, outputDir, activeStreams);

    // Return the expected URL immediately
    return { streamUrl: `/streams/${cameraId}/index.m3u8` };
  }
}

module.exports = BaseStreamStrategy;
