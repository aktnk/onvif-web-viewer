const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { testConnection } = require('../services/onvifService');
const { listV4L2Devices, testUVCDevice } = require('../services/uvcService');
const { validateCameraData, validateCameraUpdate } = require('../utils/cameraValidation');
const { startStream, stopStream } = require('../services/streamService');
const { startRecording, stopRecording } = require('../services/recordingService');
const { scanSubnet, getLocalSubnet } = require('../services/discoveryService');
const { getCameraTime, syncCameraTime } = require('../services/timeSyncService');
const { checkPTZCapability, movePTZ, stopPTZ } = require('../services/ptzService');
const onvif = require('onvif');

// GET /api/cameras - List all cameras
router.get('/', async (req, res) => {
  try {
    const cameras = await db('cameras').select('*');
    res.json(cameras);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error while fetching cameras.' });
  }
});

// GET /api/cameras/discover - Discover ONVIF cameras on the network using subnet scan
router.get('/discover', async (req, res) => {
    console.log('[Discovery] Starting subnet scan...');

    try {
        // Get subnet from query params or auto-detect
        const subnet = req.query.subnet || getLocalSubnet();
        const start = parseInt(req.query.start) || (typeof subnet === 'object' ? subnet.start : 1);
        const end = parseInt(req.query.end) || (typeof subnet === 'object' ? subnet.end : 254);

        // Perform subnet scan
        const devices = await scanSubnet({
            subnet,
            start,
            end,
            onProgress: (progress) => {
                // Log progress
                if (progress.scanned % 25 === 0 || progress.percentage === 100) {
                    console.log(`[Discovery] Progress: ${progress.percentage}% (${progress.scanned}/${progress.total}), Found: ${progress.found}`);
                }
            }
        });

        res.json({ devices });
    } catch (error) {
        console.error('[Discovery] Error during subnet scan:', error);
        res.status(500).json({ error: 'Failed to scan subnet', message: error.message });
    }
});

// GET /api/cameras/uvc/discover - Discover UVC (USB) cameras on the system
router.get('/uvc/discover', async (req, res) => {
    console.log('[UVC Discovery] Scanning for V4L2 devices...');

    try {
        const devices = listV4L2Devices();
        console.log(`[UVC Discovery] Found ${devices.length} UVC devices`);
        res.json({ devices });
    } catch (error) {
        console.error('[UVC Discovery] Error scanning for UVC devices:', error);
        res.status(500).json({ error: 'Failed to discover UVC devices', message: error.message });
    }
});

// GET /api/cameras/:id/capabilities - Get camera capabilities
router.get('/:id/capabilities', async (req, res) => {
    const { id } = req.params;

    try {
        const camera = await db('cameras').where({ id: Number(id) }).first();

        if (!camera) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        // Default capabilities
        const capabilities = {
            streaming: true,
            recording: true,
            thumbnails: true,
            ptz: false,
            discovery: false,
            timeSync: false,
            remoteAccess: false
        };

        // Type-specific capabilities
        if (camera.type === 'onvif') {
            capabilities.discovery = true;
            capabilities.timeSync = true;
            capabilities.remoteAccess = true;

            // Check PTZ capability for ONVIF cameras
            try {
                const ptzResult = await checkPTZCapability({
                    host: camera.host,
                    port: camera.port,
                    user: camera.user,
                    pass: camera.pass,
                    xaddr: camera.xaddr
                });
                capabilities.ptz = ptzResult.supported;
            } catch (err) {
                console.error(`Error checking PTZ capability for camera ${id}:`, err);
                // PTZ remains false on error
            }
        }
        // UVC cameras keep default capabilities (no PTZ, discovery, timeSync, or remoteAccess)

        res.json(capabilities);
    } catch (error) {
        console.error(`Error getting capabilities for camera ${id}:`, error);
        res.status(500).json({ error: 'An internal server error occurred while getting camera capabilities.' });
    }
});

// POST /api/cameras - Add a new camera
router.post('/', async (req, res) => {
    const { type = 'onvif', ...cameraData } = req.body;

    try {
        // Validate camera data based on type
        validateCameraData({ type, ...cameraData });

        // Type-specific connection tests
        if (type === 'onvif') {
            // Test ONVIF connection before saving
            await testConnection(cameraData);
        } else if (type === 'uvc') {
            // Test UVC device accessibility
            await testUVCDevice(cameraData.device_path);
        }

        // If tests pass, save to database
        const [newCamera] = await db('cameras')
            .insert({ type, ...cameraData })
            .returning('*');

        res.status(201).json(newCamera);

    } catch (error) {
        console.error('Error adding camera:', error);

        // Validation errors
        if (error.message.includes('require')) {
            return res.status(400).json({ message: error.message });
        }

        // Connection test errors
        if (error.message.startsWith('Failed to connect') || error.message.includes('not found')) {
            return res.status(400).json({ message: `Camera connection test failed: ${error.message}` });
        }

        // Handle potential unique constraint violation
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: `A camera with this configuration already exists.` });
        }

        return res.status(500).json({ message: 'An internal server error occurred while adding the camera.' });
    }
});

// PUT /api/cameras/:id - Update a camera
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Define allowed fields for update (whitelist)
    const ALLOWED_UPDATE_FIELDS = ['name', 'host', 'port', 'user', 'pass', 'xaddr'];
    const CONNECTION_FIELDS = ['host', 'port', 'user', 'pass', 'xaddr'];

    // Validate and filter allowed fields
    const allowedUpdates = {};
    const invalidFields = [];

    for (const [key, value] of Object.entries(updates)) {
        if (ALLOWED_UPDATE_FIELDS.includes(key)) {
            // Type validation for each field
            switch (key) {
                case 'name':
                case 'host':
                case 'user':
                case 'pass':
                case 'xaddr':
                    if (typeof value !== 'string') {
                        return res.status(400).json({
                            error: `Field '${key}' must be a string.`
                        });
                    }
                    // Don't allow empty strings for required fields
                    if ((key === 'name' || key === 'host') && value.trim() === '') {
                        return res.status(400).json({
                            error: `Field '${key}' cannot be empty.`
                        });
                    }
                    allowedUpdates[key] = value;
                    break;

                case 'port':
                    const port = Number(value);
                    if (!Number.isInteger(port) || port < 1 || port > 65535) {
                        return res.status(400).json({
                            error: 'Port must be an integer between 1 and 65535.'
                        });
                    }
                    allowedUpdates[key] = port;
                    break;

                default:
                    // Should not reach here, but handle defensively
                    invalidFields.push(key);
            }
        } else {
            invalidFields.push(key);
        }
    }

    // Report invalid fields if any
    if (invalidFields.length > 0) {
        return res.status(400).json({
            error: `Invalid or disallowed fields: ${invalidFields.join(', ')}`
        });
    }

    // Check if there are any valid updates
    if (Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid update fields provided.' });
    }

    try {
        // Fetch the current camera data
        const currentCamera = await db('cameras').where({ id: Number(id) }).first();

        if (!currentCamera) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        // Check if connection-related fields are being updated
        const isConnectionUpdate = CONNECTION_FIELDS.some(field =>
            allowedUpdates.hasOwnProperty(field)
        );

        if (isConnectionUpdate) {
            // Merge current camera data with updates to test connection
            const testConfig = {
                host: allowedUpdates.host ?? currentCamera.host,
                port: allowedUpdates.port ?? currentCamera.port,
                user: allowedUpdates.user ?? currentCamera.user,
                pass: allowedUpdates.pass ?? currentCamera.pass,
                xaddr: allowedUpdates.xaddr ?? currentCamera.xaddr
            };

            // Test the new connection configuration
            try {
                await testConnection(testConfig);
            } catch (error) {
                console.error('Connection test failed during update:', error);
                return res.status(400).json({
                    error: 'Failed to connect to camera with updated credentials.',
                    details: error.message
                });
            }
        }

        // Perform the update
        const count = await db('cameras').where({ id: Number(id) }).update(allowedUpdates);

        if (count === 0) {
            // This should not happen since we already checked, but handle defensively
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        // Fetch and return the updated camera
        const updatedCamera = await db('cameras').where({ id: Number(id) }).first();
        res.json(updatedCamera);

    } catch (error) {
        console.error(`Error updating camera ${id}:`, error);
        res.status(500).json({ error: 'An internal server error occurred while updating the camera.' });
    }
});

// DELETE /api/cameras/:id - Delete a camera
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const count = await db('cameras').where({ id: Number(id) }).del();

        if (count === 0) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        res.status(204).send(); // 204 No Content

    } catch (error) {
        console.error(`Error deleting camera ${id}:`, error);
        res.status(500).json({ error: 'An internal server error occurred while deleting the camera.' });
    }
});


// POST /api/cameras/:id/stream/start - Start a stream
router.post('/:id/stream/start', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await startStream(Number(id));
        // Respond immediately. The HLS player on the frontend is responsible for polling the playlist.
        res.json(result);
    } catch (error) {
        console.error(`Error starting stream for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cameras/:id/stream/stop - Stop a stream
router.post('/:id/stream/stop', (req, res) => {
    const { id } = req.params;
    try {
        const result = stopStream(Number(id));
        res.json(result);
    } catch (error) {
        console.error(`Error stopping stream for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cameras/:id/recording/start - Start recording
router.post('/:id/recording/start', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await startRecording(Number(id));
        res.json(result);
    } catch (error) {
        console.error(`Error starting recording for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cameras/:id/recording/stop - Stop recording
router.post('/:id/recording/stop', (req, res) => {
    const { id } = req.params;
    try {
        const result = stopRecording(Number(id));
        res.json(result);
    } catch (error) {
        console.error(`Error stopping recording for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/cameras/:id/time - Get camera's current time
router.get('/:id/time', async (req, res) => {
    const { id } = req.params;
    try {
        const camera = await db('cameras').where({ id: Number(id) }).first();

        if (!camera) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        const timeInfo = await getCameraTime({
            host: camera.host,
            port: camera.port,
            user: camera.user,
            pass: camera.pass,
            xaddr: camera.xaddr
        });

        res.json(timeInfo);
    } catch (error) {
        console.error(`Error getting time for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cameras/:id/sync-time - Synchronize camera time with server time
router.post('/:id/sync-time', async (req, res) => {
    const { id } = req.params;
    try {
        const camera = await db('cameras').where({ id: Number(id) }).first();

        if (!camera) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        const result = await syncCameraTime({
            host: camera.host,
            port: camera.port,
            user: camera.user,
            pass: camera.pass,
            xaddr: camera.xaddr
        });

        res.json(result);
    } catch (error) {
        console.error(`Error syncing time for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/cameras/:id/ptz/capabilities - Check PTZ capabilities
router.get('/:id/ptz/capabilities', async (req, res) => {
    const { id } = req.params;
    try {
        const camera = await db('cameras').where({ id: Number(id) }).first();

        if (!camera) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        const result = await checkPTZCapability({
            host: camera.host,
            port: camera.port,
            user: camera.user,
            pass: camera.pass,
            xaddr: camera.xaddr
        });

        res.json(result);
    } catch (error) {
        console.error(`Error checking PTZ capability for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cameras/:id/ptz/move - Move camera PTZ
router.post('/:id/ptz/move', async (req, res) => {
    const { id } = req.params;
    const { x, y, zoom, timeout } = req.body;

    try {
        const camera = await db('cameras').where({ id: Number(id) }).first();

        if (!camera) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        const result = await movePTZ(
            {
                host: camera.host,
                port: camera.port,
                user: camera.user,
                pass: camera.pass,
                xaddr: camera.xaddr
            },
            { x, y, zoom, timeout }
        );

        res.json(result);
    } catch (error) {
        console.error(`Error moving PTZ for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cameras/:id/ptz/stop - Stop PTZ movement
router.post('/:id/ptz/stop', async (req, res) => {
    const { id } = req.params;
    const { panTilt, zoom } = req.body;

    try {
        const camera = await db('cameras').where({ id: Number(id) }).first();

        if (!camera) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

        const result = await stopPTZ(
            {
                host: camera.host,
                port: camera.port,
                user: camera.user,
                pass: camera.pass,
                xaddr: camera.xaddr
            },
            { panTilt, zoom }
        );

        res.json(result);
    } catch (error) {
        console.error(`Error stopping PTZ for camera ${id}:`, error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
