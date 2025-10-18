const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Cam } = require('onvif');
const db = require('../db/db');

// In-memory store for active FFmpeg recording processes: Map<cameraId, { process: ChildProcess, recordingId: number }>
const activeRecordings = new Map();

// Base path for recordings output
const recordingsBasePath = path.join(__dirname, '../../recordings');
if (!fs.existsSync(recordingsBasePath)) {
    fs.mkdirSync(recordingsBasePath, { recursive: true });
}

// TODO: This function is duplicated in streamService.js. Consider moving to a shared onvifService.
async function getRtspUrl(camera) {
    return new Promise((resolve, reject) => {
        console.log(`[onvif] Connecting to camera for recording: ${camera.host}:${camera.port || 80}`);
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
            this.getStreamUri({ protocol: 'RTSP' }, (err, stream) => {
                if (err) {
                    return reject(new Error(`[onvif] Could not get stream URI: ${err.message}`));
                }
                if (!stream || !stream.uri) {
                    return reject(new Error('[onvif] Stream URI is empty in the response.'));
                }
                resolve(stream.uri);
            });
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

    const rtspUrl = await getRtspUrl(camera);
    const authenticatedRtspUrl = rtspUrl.replace('rtsp://', `rtsp://${camera.user}:${encodeURIComponent(camera.pass)}@`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cam-${cameraId}-${timestamp}.mp4`;
    const outputPath = path.join(recordingsBasePath, filename);

    // Create a record in the database
    const [recording] = await db('recordings').insert({
        camera_id: cameraId,
        filename: filename,
        start_time: new Date(),
    }).returning('*');

    const ffmpegArgs = [
        '-rtsp_transport', 'tcp',
        '-i', authenticatedRtspUrl,
        '-c:v', 'copy', // Copy video stream without re-encoding
        '-c:a', 'aac',    // Re-encode audio to AAC (most compatible)
        '-movflags', 'frag_keyframe+empty_moov', // Allow the MP4 to be streamable and fix issues if recording is interrupted
        outputPath
    ];

    console.log(`Spawning FFmpeg for recording camera ${cameraId}: ffmpeg ${ffmpegArgs.join(' ')}`);
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    activeRecordings.set(cameraId, { process: ffmpegProcess, recordingId: recording.id });

    ffmpegProcess.stderr.on('data', (data) => {
        console.log(`FFMPEG-REC (cam-${cameraId}): ${data}`);
    });

    ffmpegProcess.on('close', async (code) => {
        console.log(`FFmpeg recording process for camera ${cameraId} exited with code ${code}`);
        activeRecordings.delete(cameraId);
        
        // A code of 255 is often sent on SIGINT. A code of 0 is a clean exit.
        // Any other code indicates a problem.
        if (code !== 0 && code !== 255) {
            console.error(`FFmpeg process exited with error code ${code}. Deleting recording record.`);
            await db('recordings').where({ id: recording.id }).del();
        } else {
            // Update the database record on a clean exit
            await db('recordings').where({ id: recording.id }).update({
                end_time: new Date(),
                is_finished: true,
            });
            console.log(`Recording ${filename} marked as finished.`);
        }
    });

    ffmpegProcess.on('error', async (err) => {
        console.error(`Failed to start FFmpeg recording for camera ${cameraId}:`, err);
        activeRecordings.delete(cameraId);
        // Delete the orphaned record from the database
        await db('recordings').where({ id: recording.id }).del();
    });

    return { success: true, message: `Recording started for camera ${cameraId}.`, recordingId: recording.id, filename };
}

/**
 * Stops an active recording for a camera.
 * @param {number} cameraId - The ID of the camera.
 * @returns {Promise<object>} A promise that resolves when the recording is finalized.
 */
function stopRecording(cameraId) {
    return new Promise((resolve, reject) => {
        if (activeRecordings.has(cameraId)) {
            const { process, recordingId } = activeRecordings.get(cameraId);
            console.log(`Stopping recording for camera ${cameraId} (ID: ${recordingId})`);

            // Add a one-time listener for the 'close' event to know when the file is finalized.
            process.once('close', (code) => {
                console.log(`Recording process for camera ${cameraId} confirmed closed with code ${code}.`);
                if (code !== 0 && code !== 255) {
                    reject(new Error(`Recording process exited with an error code: ${code}`));
                } else {
                    // The existing 'close' handler will update the DB. We resolve the promise here.
                    resolve({ success: true, message: `Recording for camera ${cameraId} stopped and finalized.` });
                }
            });

            process.once('error', (err) => {
                reject(new Error(`Error stopping recording for camera ${cameraId}: ${err.message}`));
            });

            // Gracefully ask FFmpeg to finalize the file. The 'close' event will fire after this.
            process.kill('SIGINT');
            activeRecordings.delete(cameraId); // Remove immediately to prevent duplicate stop commands

        } else {
            resolve({ success: false, message: `No active recording found for camera ${cameraId}.` });
        }
    });
}

module.exports = { startRecording, stopRecording };
