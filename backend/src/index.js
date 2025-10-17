const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('public'));

// Import and use camera routes
const cameraRoutes = require('./api/cameras');
app.use('/api/cameras', cameraRoutes);

app.get('/', (req, res) => {
  res.send('ONVIF Backend Server is running!');
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
