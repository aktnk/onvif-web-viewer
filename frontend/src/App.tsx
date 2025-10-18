import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Container, CssBaseline, Box, CircularProgress, Alert } from '@mui/material';
import CameraList from './components/CameraList';
import VideoPlayer from './components/VideoPlayer';
import { startStream, stopStream } from './services/api';
import type { Camera } from './services/api';
import './App.css';

// Helper function to delay execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Polls a URL with HEAD requests until it returns a 200 OK status.
 * @param url The URL to poll.
 * @param timeout The total time in ms to poll for before giving up.
 * @param interval The time in ms between poll attempts.
 * @returns A promise that resolves when the URL is accessible.
 */
async function pollForStream(url: string, timeout = 15000, interval = 1000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      // We use a HEAD request for efficiency, as we only need the status code
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (response.ok) { // Status code 200-299
        console.log(`Stream manifest found at ${url}`);
        return; // Success
      }
      console.log(`Polling for stream... status: ${response.status}`);
    } catch (error) {
      // Network errors, etc. We'll just log and retry.
      console.log('Polling request failed, retrying...', error);
    }
    await sleep(interval);
  }
  throw new Error(`Timed out after ${timeout / 1000}s waiting for stream to become available.`);
}


function App() {
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const BACKEND_URL = 'http://localhost:3001';

  // Effect to stop the stream when the component unmounts or the tab is closed
  useEffect(() => {
    const cleanup = () => {
      if (selectedCamera) {
        // Use fetch with keepalive to ensure the request is sent even when the page is closing
        fetch(`${BACKEND_URL}/api/cameras/${selectedCamera.id}/stream/stop`, { method: 'POST', keepalive: true });
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
      // 1. Ask the backend to start the stream process
      const data = await startStream(camera.id);
      const fullStreamUrl = `${BACKEND_URL}${data.streamUrl}`;
      console.log(`Stream process started. Polling for manifest at: ${fullStreamUrl}`);

      // 2. Poll until the stream manifest (.m3u8) is available
      await pollForStream(fullStreamUrl);

      // 3. Set the URL to render the player
      setStreamUrl(fullStreamUrl);

    } catch (error) {
      console.error('Failed to start or poll for stream:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please check the backend logs.';
      setStreamError(`Failed to start stream. ${errorMessage}`);
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