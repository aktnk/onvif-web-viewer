const fs = require('fs');
const path = require('path');
const db = require('../db/db');
const ONVIFStreamStrategy = require('./streaming/ONVIFStreamStrategy');
const RTSPStreamStrategy = require('./streaming/RTSPStreamStrategy');

// In-memory store for active FFmpeg processes: Map<cameraId, ChildProcess>
const activeStreams = new Map();

// Base path for HLS stream output
const streamsBasePath = path.join(__dirname, '../../public/streams');
if (!fs.existsSync(streamsBasePath)) {
    fs.mkdirSync(streamsBasePath, { recursive: true });
}

/**
 * Factory function to get appropriate streaming strategy for a camera
 * @param {Object} camera - Camera configuration from database
 * @returns {BaseStreamStrategy} Appropriate strategy instance
 */
function getStreamStrategy(camera) {
  switch (camera.type) {
    case 'onvif':
      return new ONVIFStreamStrategy(streamsBasePath);
    case 'rtsp':
      return new RTSPStreamStrategy(streamsBasePath);
    default:
      throw new Error(`Unknown camera type: ${camera.type}`);
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
        return { streamUrl: `/streams/${cameraId}/stream.m3u8` };
    }

    const camera = await db('cameras').where({ id: cameraId }).first();
    if (!camera) {
        throw new Error(`Camera with ID ${cameraId} not found.`);
    }

    console.log(`[StreamService] Camera ${cameraId} data:`, JSON.stringify(camera, null, 2));

    // Get appropriate strategy for this camera type
    const strategy = getStreamStrategy(camera);

    // Spawn FFmpeg process using strategy
    const ffmpegProcess = await strategy.spawnFFmpeg(camera);
    activeStreams.set(cameraId, ffmpegProcess);

    const outputDir = path.join(streamsBasePath, String(cameraId));

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

    // It takes a few seconds for the first .m3u8 file to be created.
    // We return the expected URL immediately.
    return { streamUrl: `/streams/${cameraId}/stream.m3u8` };
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
 * Check if a camera is currently streaming
 * @param {number} cameraId - The ID of the camera
 * @returns {boolean} True if camera is streaming
 */
function isStreaming(cameraId) {
    return activeStreams.has(cameraId);
}

module.exports = { startStream, stopStream, isStreaming };
