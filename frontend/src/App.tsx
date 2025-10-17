import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Container, CssBaseline, Box, CircularProgress, Alert } from '@mui/material';
import CameraList from './components/CameraList';
import VideoPlayer from './components/VideoPlayer';
import { startStream, stopStream } from './services/api';
import type { Camera } from './services/api';
import './App.css';

function App() {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Effect to stop the stream when the component unmounts or the tab is closed
  useEffect(() => {
    const cleanup = () => {
      if (selectedCamera) {
        // This is a fire-and-forget call, we don't need to wait for it
        navigator.sendBeacon(`/api/cameras/${selectedCamera.id}/stream/stop`);
      }
    };
    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      if (selectedCamera) {
        stopStream(selectedCamera.id);
      }
    };
  }, [selectedCamera]);

  const handleSelectCamera = async (camera: Camera) => {
    setStreamError(null);

    // If another stream is active, stop it first
    if (selectedCamera && selectedCamera.id !== camera.id) {
      await stopStream(selectedCamera.id);
    }
    
    // If the same camera is clicked again, toggle it off
    if (selectedCamera && selectedCamera.id === camera.id) {
        await stopStream(camera.id);
        setSelectedCamera(null);
        setStreamUrl(null);
        return;
    }

    setSelectedCamera(camera);
    setStreamUrl(null); // Clear previous stream URL
    setIsLoadingStream(true);

    try {
      const data = await startStream(camera.id);
      setStreamUrl(data.streamUrl);
    } catch (error) {
      console.error('Failed to start stream:', error);
      setStreamError('Failed to start stream. Please check the backend logs.');
      setSelectedCamera(null);
    } finally {
      setIsLoadingStream(false);
    }
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

          {selectedCamera && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Live Stream: {selectedCamera.name}
              </Typography>
              {isLoadingStream ? (
                <CircularProgress />
              ) : streamError ? (
                <Alert severity="error">{streamError}</Alert>
              ) : streamUrl ? (
                <VideoPlayer streamUrl={streamUrl} />
              ) : null}
            </Box>
          )}
        </Container>
      </main>
    </>
  );
}

export default App;