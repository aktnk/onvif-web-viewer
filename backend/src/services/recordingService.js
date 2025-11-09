const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const db = require('../db/db');
const ONVIFRecordingStrategy = require('./recording/ONVIFRecordingStrategy');
const RTSPRecordingStrategy = require('./recording/RTSPRecordingStrategy');

// In-memory store for active FFmpeg recording processes: Map<cameraId, { process: ChildProcess, recordingId: number, filename: string }>
const activeRecordings = new Map();

// Base path for recordings output
const recordingsBasePath = path.join(__dirname, '../../recordings');
if (!fs.existsSync(recordingsBasePath)) {
    fs.mkdirSync(recordingsBasePath, { recursive: true });
}

// Base path for thumbnails output
const thumbnailsBasePath = path.join(__dirname, '../../thumbnails');
if (!fs.existsSync(thumbnailsBasePath)) {
    fs.mkdirSync(thumbnailsBasePath, { recursive: true });
}

/**
 * Factory function to get appropriate recording strategy for a camera
 * @param {Object} camera - Camera configuration from database
 * @returns {BaseRecordingStrategy} Appropriate strategy instance
 */
function getRecordingStrategy(camera) {
  switch (camera.type) {
    case 'onvif':
      return new ONVIFRecordingStrategy(recordingsBasePath);
    case 'rtsp':
      return new RTSPRecordingStrategy(recordingsBasePath);
    default:
      throw new Error(`Unknown camera type: ${camera.type}`);
  }
}

/**
 * Generates a thumbnail from a video file.
 * @param {string} videoPath - The path to the video file.
 * @param {string} thumbnailFilename - The filename for the thumbnail.
 * @returns {Promise<string>} The thumbnail filename.
 */
function generateThumbnail(videoPath, thumbnailFilename) {
    return new Promise((resolve, reject) => {
        const thumbnailPath = path.join(thumbnailsBasePath, thumbnailFilename);

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
 * Starts recording a camera's stream to an MP4 file.
 * @param {number} cameraId - The ID of the camera.
 * @returns {Promise<object>} An object containing the recording details.
 */
async function startRecording(cameraId) {
    if (activeRecordings.has(cameraId)) {
        throw new Error(`Recording is already in progress for camera ${cameraId}.`);
    }

    const camera = await db('cameras').where({ id: cameraId }).first();
    if (!camera) {
        throw new Error(`Camera with ID ${cameraId} not found.`);
    }

    // Get appropriate strategy for this camera type
    const strategy = getRecordingStrategy(camera);

    // Create a record in the database
    const [recording] = await db('recordings').insert({
        camera_id: cameraId,
        filename: '',  // Will be updated after we get the filename from strategy
        start_time: new Date(),
    }).returning('*');

    try {
        // Spawn FFmpeg process using strategy
        const { process: ffmpegProcess, filename } = await strategy.spawnFFmpeg(camera);

        // Update the recording with the actual filename
        await db('recordings').where({ id: recording.id }).update({ filename });

        const outputPath = path.join(recordingsBasePath, filename);
        activeRecordings.set(cameraId, { process: ffmpegProcess, recordingId: recording.id, filename });

        ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString();
            if (message.includes('error') || message.includes('Error')) {
                console.error(`FFMPEG-REC (cam-${cameraId}): ${message}`);
            }
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
                    thumbnailFilename = await generateThumbnail(outputPath, thumbnailName);
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

        return { success: true, message: `Recording started for camera ${cameraId}.`, recordingId: recording.id, filename };
    } catch (err) {
        // If strategy throws an error, delete the database record
        await db('recordings').where({ id: recording.id }).del();
        throw err;
    }
}

/**
 * Stops an active recording for a camera.
 * @param {number} cameraId - The ID of the camera.
 * @returns {Promise<object>} A promise that resolves when the recording is finalized.
 */
function stopRecording(cameraId) {
    return new Promise((resolve, reject) => {
        if (!activeRecordings.has(cameraId)) {
            return resolve({ success: false, message: `No active recording found for camera ${cameraId}.` });
        }

        const { process, recordingId } = activeRecordings.get(cameraId);
        console.log(`Stopping recording for camera ${cameraId} (ID: ${recordingId})`);

        // Store the resolve/reject functions to be called after processing completes
        const recordingInfo = activeRecordings.get(cameraId);
        recordingInfo.stopResolve = resolve;
        recordingInfo.stopReject = reject;

        // Gracefully ask FFmpeg to finalize the file. The 'close' event will fire after this.
        process.kill('SIGINT');
        // Note: We don't delete from activeRecordings here - it will be deleted in the close handler
    });
}

module.exports = { startRecording, stopRecording };
