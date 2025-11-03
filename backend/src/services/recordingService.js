const fs = require('fs');
const path = require('path');
const db = require('../db/db');
const ONVIFRecordingStrategy = require('./recording/ONVIFRecordingStrategy');
const UVCRecordingStrategy = require('./recording/UVCRecordingStrategy');
const UVC_RTSPRecordingStrategy = require('./recording/UVC_RTSPRecordingStrategy');
const { isStreaming } = require('./streamService');

// In-memory store for active FFmpeg recording processes: Map<cameraId, { process: ChildProcess, recordingId: number }>
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
 * Factory function to get the appropriate recording strategy based on camera type.
 * @param {Object} camera - Camera object from database
 * @returns {BaseRecordingStrategy} Recording strategy instance
 */
function getRecordingStrategy(camera) {
  switch (camera.type) {
    case 'onvif':
      return new ONVIFRecordingStrategy(recordingsBasePath, thumbnailsBasePath);
    case 'uvc':
      return new UVCRecordingStrategy(recordingsBasePath, thumbnailsBasePath);
    case 'uvc_rtsp':
      return new UVC_RTSPRecordingStrategy(recordingsBasePath, thumbnailsBasePath);
    default:
      throw new Error(`Unknown camera type: ${camera.type}. Supported types: onvif, uvc, uvc_rtsp`);
  }
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

    // Check if UVC camera is currently streaming (device can only be accessed by one process)
    if (camera.type === 'uvc' && isStreaming(cameraId)) {
        throw new Error(
            `Cannot start recording for UVC camera ${cameraId} while streaming is active. ` +
            `UVC cameras can only be accessed by one process at a time. ` +
            `Please stop the stream before starting recording.`
        );
    }

    const strategy = getRecordingStrategy(camera);
    return await strategy.startRecording(camera, cameraId, activeRecordings);
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
