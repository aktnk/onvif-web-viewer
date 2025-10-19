const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Cam } = require('onvif');
const db = require('../db/db');

// In-memory store for active FFmpeg processes: Map<cameraId, ChildProcess>
const activeStreams = new Map();

// Base path for HLS stream output
const streamsBasePath = path.join(__dirname, '../../public/streams');
if (!fs.existsSync(streamsBasePath)) {
    fs.mkdirSync(streamsBasePath, { recursive: true });
}

/**
 * Retrieves the RTSP stream URL for a given camera.
 * @param {object} camera - The camera object from the database.
 * @returns {Promise<string>} The RTSP URL.
 */
async function getRtspUrl(camera) {
    return new Promise((resolve, reject) => {
        console.log(`[onvif] Connecting to camera: ${camera.host}:${camera.port || 80}`);
        const cam = new Cam({
            hostname: camera.host,
            username: camera.user,
            password: camera.pass,
            port: camera.port || 80,
            timeout: 10000
        }, function(err) {
            if (err) {
                console.error('[onvif] Connection Error:', err);
                return reject(new Error(`[onvif] Connection failed: ${err.message}`));
            }

            console.log('[onvif] Connected successfully. Device info:', this.device);

            this.getStreamUri({ protocol: 'RTSP' }, (err, stream) => {
                if (err) {
                    console.error('[onvif] getStreamUri Error:', err);
                    return reject(new Error(`[onvif] Could not get stream URI: ${err.message}`));
                }
                if (!stream || !stream.uri) {
                    console.error('[onvif] Stream URI response is empty. Available profiles:', this.profiles);
                    return reject(new Error('[onvif] Stream URI is empty in the response.'));
                }
                console.log(`[onvif] Found RTSP URI: ${stream.uri}`);
                resolve(stream.uri);
            });
        });
    });
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

    const originalUrl = await getRtspUrl(camera);

    // Use URL object to safely parse and then manually reconstruct the URL
    const url = new URL(originalUrl);
    const authenticatedRtspUrl = `rtsp://${camera.user}:${encodeURIComponent(camera.pass)}@${url.hostname}:${url.port}${url.pathname}${url.search}`;
    console.log(`Authenticated RTSP URL for FFmpeg: ${authenticatedRtspUrl}`);

    const outputDir = path.join(streamsBasePath, String(cameraId));

    // Clean up directory from any previous session
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    const ffmpegArgs = [
        '-rtsp_transport', 'tcp', // Use TCP for more reliable connection
        '-i', authenticatedRtspUrl,
        '-c:v', 'copy',          // Copy video codec without re-encoding
        '-c:a', 'aac',           // Re-encode audio to AAC
        '-f', 'hls',
        '-hls_time', '2',         // 2-second segments
        '-hls_list_size', '5',    // Keep 5 segments in the playlist
        '-hls_flags', 'delete_segments', // Delete old segments to save space
        path.join(outputDir, 'index.m3u8')
    ];

    console.log(`Spawning FFmpeg for camera ${cameraId}: ffmpeg ${ffmpegArgs.join(' ')}`);
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
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

    // It takes a few seconds for the first .m3u8 file to be created.
    // We return the expected URL immediately.
    return { streamUrl: `/streams/${cameraId}/index.m3u8` };
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

module.exports = { startStream, stopStream };
