const express = require('express');
const router = express.Router();
const db = require('../db/db');
const fs = require('fs');
const path = require('path');

// Base path for recordings
const recordingsBasePath = path.join(__dirname, '../../recordings');

// GET /api/recordings - List all finished recordings
router.get('/', async (req, res) => {
  try {
    const recordings = await db('recordings')
      .leftJoin('cameras', 'recordings.camera_id', 'cameras.id')
      .select(
        'recordings.id',
        'recordings.filename',
        'recordings.start_time',
        'recordings.end_time',
        db.raw("COALESCE(cameras.name, 'Deleted Camera') as camera_name")
      )
      .where('recordings.is_finished', true)
      .orderBy('recordings.start_time', 'desc');

    res.json(recordings);
  } catch (error) {
    console.error('Database error while fetching recordings:', error);
    res.status(500).json({ error: 'Database error while fetching recordings.' });
  }
});

// DELETE /api/recordings/:id - Delete a recording
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Get recording details from database
    const recording = await db('recordings').where({ id: Number(id) }).first();

    if (!recording) {
      return res.status(404).json({ error: `Recording with ID ${id} not found.` });
    }

    // Construct file path
    const filePath = path.join(recordingsBasePath, recording.filename);

    // Delete the file from filesystem
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[recordings] Deleted file: ${filePath}`);
      } else {
        console.warn(`[recordings] File not found: ${filePath}, will delete database record anyway`);
      }
    } catch (fileError) {
      console.error(`[recordings] Error deleting file ${filePath}:`, fileError);
      // Continue to delete database record even if file deletion fails
    }

    // Delete the record from database
    const count = await db('recordings').where({ id: Number(id) }).del();

    if (count === 0) {
      return res.status(404).json({ error: `Recording with ID ${id} not found in database.` });
    }

    console.log(`[recordings] Successfully deleted recording ID ${id}`);
    res.status(204).send(); // 204 No Content

  } catch (error) {
    console.error(`Error deleting recording ${id}:`, error);
    res.status(500).json({ error: 'An internal server error occurred while deleting the recording.' });
  }
});

module.exports = router;
