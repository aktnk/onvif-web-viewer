const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

// Enable CORS for requests from the frontend development server
app.use(cors({ origin: 'http://localhost:5173' }));

app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('public'));
app.use('/recordings', express.static('recordings'));

// Import and use camera routes
const cameraRoutes = require('./api/cameras');
const recordingRoutes = require('./api/recordings');
app.use('/api/cameras', cameraRoutes);
app.use('/api/recordings', recordingRoutes);

app.get('/', (req, res) => {
  res.send('ONVIF Backend Server is running!');
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
