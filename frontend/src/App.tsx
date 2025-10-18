import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Container, CssBaseline, Box, CircularProgress, Alert } from '@mui/material';
import CameraList from './components/CameraList';
import VideoPlayer from './components/VideoPlayer';
import { getCameras, startStream, stopStream } from './services/api';
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
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (response.ok) {
        console.log(`Stream manifest found at ${url}`);
        return;
      }
      console.log(`Polling for stream... status: ${response.status}`);
    } catch (error) {
      console.log('Polling request failed, retrying...', error);
    }
    await sleep(interval);
  }
  throw new Error(`Timed out after ${timeout / 1000}s waiting for stream to become available.`);
}

const SESSION_STORAGE_KEY = 'selectedCameraId';

function App() {
  // State for camera list
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [camerasLoading, setCamerasLoading] = useState<boolean>(true);
  const [camerasError, setCamerasError] = useState<string | null>(null);

  // State for selected camera and stream
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const BACKEND_URL = 'http://localhost:3001';

  // Fetch cameras on initial load and handle auto-stream-restart
  useEffect(() => {
    const fetchAndRestore = async () => {
      try {
        setCamerasLoading(true);
        const camerasData = await getCameras();
        setCameras(camerasData);
        setCamerasError(null);

        // Check session storage for a previously selected camera
        const savedCameraId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedCameraId) {
          const cameraToRestore = camerasData.find(c => c.id === parseInt(savedCameraId, 10));
          if (cameraToRestore) {
            console.log(`Restoring stream for camera: ${cameraToRestore.name}`);
            // Use a timeout to ensure this runs after the initial render cycle
            setTimeout(() => handleSelectCamera(cameraToRestore), 0);
          }
        }
      } catch (err) {
        setCamerasError('Failed to fetch cameras. Is the backend server running?');
        console.error(err);
      } finally {
        setCamerasLoading(false);
      }
    };
    fetchAndRestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Effect to stop the stream when the component unmounts or the tab is closed
  useEffect(() => {
    const cleanup = () => {
      if (selectedCamera) {
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

    if (selectedCamera && selectedCamera.id !== camera.id) {
      await stopStream(selectedCamera.id);
    }
    
    if (selectedCamera && selectedCamera.id === camera.id) {
        await stopStream(camera.id);
        setSelectedCamera(null);
        setStreamUrl(null);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return;
    }

    setSelectedCamera(camera);
    setStreamUrl(null);
    setIsLoadingStream(true);

    try {
      const data = await startStream(camera.id);
      const fullStreamUrl = `${BACKEND_URL}${data.streamUrl}`;
      console.log(`Stream process started. Polling for manifest at: ${fullStreamUrl}`);

      await pollForStream(fullStreamUrl);

      setStreamUrl(fullStreamUrl);
      sessionStorage.setItem(SESSION_STORAGE_KEY, String(camera.id));

    } catch (error) {
      console.error('Failed to start or poll for stream:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please check the backend logs.';
      setStreamError(`Failed to start stream. ${errorMessage}`);
      setSelectedCamera(null);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
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
          <CameraList 
            cameras={cameras}
            loading={camerasLoading}
            error={camerasError}
            onSelectCamera={handleSelectCamera} 
          />

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