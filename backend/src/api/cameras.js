const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { testConnection } = require('../services/onvifService');
const { startStream, stopStream } = require('../services/streamService');
const { startRecording, stopRecording } = require('../services/recordingService');
const { scanSubnet, getLocalSubnet } = require('../services/discoveryService');
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

// POST /api/cameras - Add a new camera
router.post('/', async (req, res) => {
    const { name, host, port, user, pass, xaddr } = req.body; // Added xaddr

    if (!name || !host) {
        return res.status(400).json({ error: 'Missing required fields: name, host' });
    }

    try {
        // 1. Test connection to the camera before saving
        await testConnection({ host, port, user, pass, xaddr });

        // 2. If connection is successful, save to the database
        const [newCamera] = await db('cameras').insert({ name, host, port, user, pass, xaddr }).returning('*');
        res.status(201).json(newCamera);

    } catch (error) {
        console.error('Error adding camera:', error); // Log all errors immediately

        // Differentiate between a camera connection error and other internal errors
        if (error.message.startsWith('Failed to connect')) {
            return res.status(400).json({ message: `Camera connection failed. Please check host, port, and credentials. Details: ${error.message}` });
        }

        // Handle potential unique constraint violation (e.g., host already exists)
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: `A camera with host '${host}' already exists.` });
        }

        return res.status(500).json({ message: 'An internal server error occurred while adding the camera.' });
    }
});

// PUT /api/cameras/:id - Update a camera
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (updates.id) {
        delete updates.id;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No update fields provided.' });
    }

    try {
        const count = await db('cameras').where({ id: Number(id) }).update(updates);

        if (count === 0) {
            return res.status(404).json({ error: `Camera with ID ${id} not found.` });
        }

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


module.exports = router;
