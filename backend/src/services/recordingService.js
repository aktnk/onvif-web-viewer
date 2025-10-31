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

// Base path for thumbnails output
const thumbnailsBasePath = path.join(__dirname, '../../thumbnails');
if (!fs.existsSync(thumbnailsBasePath)) {
    fs.mkdirSync(thumbnailsBasePath, { recursive: true });
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

    const originalUrl = await getRtspUrl(camera);
    const url = new URL(originalUrl); // Use URL to safely parse components
    const authenticatedRtspUrl = `rtsp://${camera.user}:${encodeURIComponent(camera.pass)}@${url.hostname}:${url.port}${url.pathname}${url.search}`;

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
        '-c:a', 'copy',   // Attempt to copy audio stream
        '-an',          // Disable audio recording if copying fails or no audio stream exists
        '-movflags', 'frag_keyframe+empty_moov', // Allow the MP4 to be streamable and fix issues if recording is interrupted
        outputPath
    ];

    console.log(`Spawning FFmpeg for recording camera ${cameraId}: ffmpeg ${ffmpegArgs.join(' ')}`);
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    activeRecordings.set(cameraId, { process: ffmpegProcess, recordingId: recording.id });

    ffmpegProcess.stderr.on('data', (data) => {
        console.error(`FFMPEG-REC (cam-${cameraId}): ${data}`);
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
