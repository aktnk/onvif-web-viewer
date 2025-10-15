const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { testConnection } = require('../services/onvifService');

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

// POST /api/cameras - Add a new camera
router.post('/', async (req, res) => {
    const { name, host, port, user, pass } = req.body;

    if (!name || !host || !user || !pass) {
        return res.status(400).json({ error: 'Missing required fields: name, host, user, pass' });
    }

    try {
        // 1. Test connection to the camera before saving
        await testConnection({ host, port, user, pass });

        // 2. If connection is successful, save to the database
        const [newCamera] = await db('cameras').insert({ name, host, port, user, pass }).returning('*');
        res.status(201).json(newCamera);

    } catch (error) {
        // Differentiate between a camera connection error and other internal errors
        if (error.message.startsWith('Failed to connect')) {
            return res.status(400).json({ error: `Camera connection failed. Please check host, port, and credentials. Details: ${error.message}` });
        }

        // Handle potential unique constraint violation (e.g., host already exists)
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: `A camera with host '${host}' already exists.` });
        }

        console.error('Error adding camera:', error);
        return res.status(500).json({ error: 'An internal server error occurred while adding the camera.' });
    }
});


module.exports = router;
