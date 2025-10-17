import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, CssBaseline } from '@mui/material';
import CameraList from './components/CameraList';
import type { Camera } from './services/api';
import './App.css';

function App() {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);

  const handleSelectCamera = (camera: Camera) => {
    console.log('Selected camera:', camera);
    setSelectedCamera(camera);
    // We will implement the video player next
  };

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div">
            ONVIF Web Viewer
          </Typography>
        </Toolbar>
      </AppBar>
      <main>
        <Container sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Cameras
          </Typography>
          <CameraList onSelectCamera={handleSelectCamera} />
          {/* Video player will be rendered here based on selectedCamera */}
          {selectedCamera && (
            <div>
              <Typography variant="h5" component="h2" sx={{ mt: 4 }}>
                Live Stream: {selectedCamera.name}
              </Typography>
              {/* VideoPlayer component will go here */}
            </div>
          )}
        </Container>
      </main>
    </>
  );
}

export default App;