const express = require('express');
const router = express.Router();
const db = require('../db/db');

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

module.exports = router;
