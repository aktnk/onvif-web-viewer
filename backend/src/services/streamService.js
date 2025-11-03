const fs = require('fs');
const path = require('path');
const db = require('../db/db');
const ONVIFStreamStrategy = require('./streaming/ONVIFStreamStrategy');
const UVCStreamStrategy = require('./streaming/UVCStreamStrategy');
const UVC_RTSPStreamStrategy = require('./streaming/UVC_RTSPStreamStrategy');

// In-memory store for active FFmpeg processes: Map<cameraId, ChildProcess>
const activeStreams = new Map();

// Base path for HLS stream output
const streamsBasePath = path.join(__dirname, '../../public/streams');
if (!fs.existsSync(streamsBasePath)) {
    fs.mkdirSync(streamsBasePath, { recursive: true });
}

/**
 * Factory function to get the appropriate streaming strategy based on camera type.
 * @param {Object} camera - Camera object from database
 * @returns {BaseStreamStrategy} Streaming strategy instance
 */
function getStreamStrategy(camera) {
  switch (camera.type) {
    case 'onvif':
      return new ONVIFStreamStrategy(streamsBasePath);
    case 'uvc':
      return new UVCStreamStrategy(streamsBasePath);
    case 'uvc_rtsp':
      return new UVC_RTSPStreamStrategy(streamsBasePath);
    default:
      throw new Error(`Unknown camera type: ${camera.type}. Supported types: onvif, uvc, uvc_rtsp`);
  }
}

/**
 * Starts an HLS stream for a camera using FFmpeg.
 * @param {number} cameraId - The ID of the camera.
 * @returns {Promise<object>} An object containing the stream URL.
 */
async function startStream(cameraId) {
    if (activeStreams.has(cameraId)) {
        console.log(`Stream for camera ${cameraId} is already running.`);
        return { streamUrl: `/streams/${cameraId}/index.m3u8` };
    }

    const camera = await db('cameras').where({ id: cameraId }).first();
    if (!camera) {
        throw new Error(`Camera with ID ${cameraId} not found.`);
    }

    const strategy = getStreamStrategy(camera);
    return await strategy.startStream(camera, cameraId, activeStreams);
}

/**
 * Stops an active HLS stream for a camera.
 * @param {number} cameraId - The ID of the camera.
 * @returns {object} A result object.
 */
function stopStream(cameraId) {
    if (activeStreams.has(cameraId)) {
        const process = activeStreams.get(cameraId);
        console.log(`Stopping stream for camera ${cameraId}`);
        process.kill('SIGINT'); // Gracefully ask FFmpeg to stop
        activeStreams.delete(cameraId);
        return { success: true, message: `Stream for camera ${cameraId} stopped.` };
    }
    return { success: false, message: `No active stream found for camera ${cameraId}.` };
}

/**
 * Checks if a camera is currently streaming.
 * @param {number} cameraId - The ID of the camera.
 * @returns {boolean} True if the camera is currently streaming.
 */
function isStreaming(cameraId) {
  return activeStreams.has(cameraId);
}

module.exports = { startStream, stopStream, isStreaming };
