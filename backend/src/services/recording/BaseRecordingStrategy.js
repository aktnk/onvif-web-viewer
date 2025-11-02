const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../../db/db');

/**
 * Base class for recording strategies.
 * Provides common FFmpeg process management and MP4 recording configuration.
 */
class BaseRecordingStrategy {
  constructor(recordingsBasePath, thumbnailsBasePath) {
    this.recordingsBasePath = recordingsBasePath;
    this.thumbnailsBasePath = thumbnailsBasePath;
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
   * Get FFmpeg input arguments for recording.
   * Must be implemented by subclasses.
   * @param {string} inputUrl - Input URL
   * @returns {Array<string>} FFmpeg input arguments
   */
  getFFmpegInputArgs(inputUrl) {
    throw new Error('getFFmpegInputArgs() must be implemented by subclass');
  }

  /**
   * Get common MP4 output arguments.
   * @param {string} outputPath - Path to output MP4 file
   * @returns {Array<string>} FFmpeg output arguments
   */
  getMP4OutputArgs(outputPath) {
    return [
      '-movflags', 'frag_keyframe+empty_moov', // Allow the MP4 to be streamable and fix issues if recording is interrupted
      outputPath
    ];
  }

  /**
   * Generates a thumbnail from a video file.
   * @param {string} videoPath - The path to the video file.
   * @param {string} thumbnailFilename - The filename for the thumbnail.
   * @returns {Promise<string>} The thumbnail filename.
   */
  generateThumbnail(videoPath, thumbnailFilename) {
    return new Promise((resolve, reject) => {
      const thumbnailPath = path.join(this.thumbnailsBasePath, thumbnailFilename);

      // Extract a frame from 2 seconds into the video
      const ffmpegArgs = [
        '-i', videoPath,
        '-ss', '00:00:02',  // Seek to 2 seconds
        '-vframes', '1',     // Extract 1 frame
        '-vf', 'scale=320:-1', // Scale to width 320px, maintain aspect ratio
        '-q:v', '2',         // Quality (2-5 is good, lower is better)
        thumbnailPath
      ];

      console.log(`Generating thumbnail: ffmpeg ${ffmpegArgs.join(' ')}`);
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      let stderr = '';
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`Thumbnail generated: ${thumbnailFilename}`);
          resolve(thumbnailFilename);
        } else {
          console.error(`FFmpeg thumbnail generation failed with code ${code}: ${stderr}`);
          reject(new Error(`Failed to generate thumbnail: exit code ${code}`));
        }
      });

      ffmpegProcess.on('error', (err) => {
        console.error('Failed to spawn FFmpeg for thumbnail:', err);
        reject(err);
      });
    });
  }

  /**
   * Spawn FFmpeg process with common recording management logic.
   * @param {number} cameraId - Camera ID
   * @param {Array<string>} args - Complete FFmpeg arguments
   * @param {Object} recording - Recording database record
   * @param {string} outputPath - Output file path
   * @param {string} filename - Output filename
   * @param {Map} activeRecordings - Map to track active processes
   * @returns {ChildProcess} Spawned FFmpeg process
   */
  spawnFFmpeg(cameraId, args, recording, outputPath, filename, activeRecordings) {
    console.log(`Spawning FFmpeg for recording camera ${cameraId}: ffmpeg ${args.join(' ')}`);
    const ffmpegProcess = spawn('ffmpeg', args);

    activeRecordings.set(cameraId, { process: ffmpegProcess, recordingId: recording.id });

    ffmpegProcess.stderr.on('data', (data) => {
      console.error(`FFMPEG-REC (cam-${cameraId}): ${data}`);
    });

    ffmpegProcess.on('close', async (code) => {
      console.log(`FFmpeg recording process for camera ${cameraId} exited with code ${code}`);

      // Get the recording info before deleting (to access stopResolve/stopReject if present)
      const recordingInfo = activeRecordings.get(cameraId);
      activeRecordings.delete(cameraId);

      // A code of 255 is often sent on SIGINT. A code of 0 is a clean exit.
      // Any other code indicates a problem.
      if (code !== 0 && code !== 255) {
        console.error(`FFmpeg process exited with error code ${code}. Deleting recording record.`);
        await db('recordings').where({ id: recording.id }).del();

        // Reject the stopRecording promise if it exists
        if (recordingInfo?.stopReject) {
          recordingInfo.stopReject(new Error(`Recording process exited with an error code: ${code}`));
        }
      } else {
        // Generate thumbnail
        let thumbnailFilename = null;
        try {
          const thumbnailName = filename.replace('.mp4', '.jpg');
          thumbnailFilename = await this.generateThumbnail(outputPath, thumbnailName);
          console.log(`Thumbnail generated for recording ${filename}: ${thumbnailFilename}`);
        } catch (err) {
          console.error(`Failed to generate thumbnail for recording ${filename}:`, err);
          // Continue without thumbnail - don't fail the recording
        }

        // Update the database record on a clean exit
        await db('recordings').where({ id: recording.id }).update({
          end_time: new Date(),
          is_finished: true,
          thumbnail: thumbnailFilename,
        });
        console.log(`Recording ${filename} marked as finished.`);

        // Resolve the stopRecording promise if it exists
        if (recordingInfo?.stopResolve) {
          recordingInfo.stopResolve({ success: true, message: `Recording for camera ${cameraId} stopped and finalized.` });
        }
      }
    });

    ffmpegProcess.on('error', async (err) => {
      console.error(`Failed to start FFmpeg recording for camera ${cameraId}:`, err);
      activeRecordings.delete(cameraId);
      // Delete the orphaned record from the database
      await db('recordings').where({ id: recording.id }).del();
    });

    return ffmpegProcess;
  }

  /**
   * Start recording for a camera.
   * Template method that orchestrates the recording setup.
   * @param {Object} camera - Camera object from database
   * @param {number} cameraId - Camera ID
   * @param {Map} activeRecordings - Map to track active processes
   * @returns {Promise<Object>} Object containing recording details
   */
  async startRecording(camera, cameraId, activeRecordings) {
    const inputUrl = await this.getInputUrl(camera);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cam-${cameraId}-${timestamp}.mp4`;
    const outputPath = path.join(this.recordingsBasePath, filename);

    // Create a record in the database
    const [recording] = await db('recordings').insert({
      camera_id: cameraId,
      filename: filename,
      start_time: new Date(),
    }).returning('*');

    const inputArgs = this.getFFmpegInputArgs(inputUrl);
    const outputArgs = this.getMP4OutputArgs(outputPath);
    const ffmpegArgs = [...inputArgs, ...outputArgs];

    this.spawnFFmpeg(cameraId, ffmpegArgs, recording, outputPath, filename, activeRecordings);

    return { success: true, message: `Recording started for camera ${cameraId}.`, recordingId: recording.id, filename };
  }
}

module.exports = BaseRecordingStrategy;
