import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppBar, Toolbar, Typography, Container, CssBaseline, Box, CircularProgress, Alert, Button, Modal } from '@mui/material';
import CameraList from './components/CameraList';
import VideoPlayer from './components/VideoPlayer';
import RecordingList from './components/RecordingList';
import AddCameraModal from './components/AddCameraModal';
import { getCameras, startStream, stopStream, startRecording, stopRecording } from './services/api';
import type { Camera } from './services/api';
import './App.css';

// Style for the modal
const modalStyle = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80vw',
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

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
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');

  // State for playback modal
  const [isPlaybackModalOpen, setIsPlaybackModalOpen] = useState(false);
  const [playingRecordingUrl, setPlayingRecordingUrl] = useState<string | null>(null);

  // State for Add Camera Modal
  const [isAddCameraModalOpen, setIsAddCameraModalOpen] = useState(false);

  // State to trigger recording list refresh
  const [recordingListVersion, setRecordingListVersion] = useState(0);

  const BACKEND_URL = 'http://localhost:3001';
  // Using a ref to give cleanup effects access to the latest state
  const stateRef = useRef({ selectedCamera, recordingStatus });
  useEffect(() => {
    stateRef.current = { selectedCamera, recordingStatus };
  });

  const fetchCameras = useCallback(async (cameraToRestoreId?: number) => {
    try {
      setCamerasLoading(true);
      const camerasData = await getCameras();
      setCameras(camerasData);
      setCamerasError(null);

      if (cameraToRestoreId) {
        const cameraToRestore = camerasData.find(c => c.id === cameraToRestoreId);
        if (cameraToRestore) {
          console.log(`Restoring stream for camera: ${cameraToRestore.name}`);
          // Use timeout to ensure state updates are processed before starting stream
          setTimeout(() => handleSelectCamera(cameraToRestore), 0);
        }
      }
    } catch (err) {
      setCamerasError('Failed to fetch cameras. Is the backend server running?');
      console.error(err);
    } finally {
      setCamerasLoading(false);
    }
  }, []); // Empty dependency array, but we'll call it manually

  // Fetch cameras on initial load
  useEffect(() => {
    const savedCameraId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    fetchCameras(savedCameraId ? parseInt(savedCameraId, 10) : undefined);
  }, [fetchCameras]);


  // Effect to handle cleanup on unmount or page unload
  useEffect(() => {
    const handleCleanup = (isUnloading = false) => {
      const { selectedCamera: currentCamera, recordingStatus: currentRecordingStatus } = stateRef.current;
      if (currentCamera) {
        if (currentRecordingStatus === 'recording') {
          const stopRecUrl = `${BACKEND_URL}/api/cameras/${currentCamera.id}/recording/stop`;
          isUnloading ? fetch(stopRecUrl, { method: 'POST', keepalive: true }) : stopRecording(currentCamera.id);
        }
        const stopStreamUrl = `${BACKEND_URL}/api/cameras/${currentCamera.id}/stream/stop`;
        isUnloading ? fetch(stopStreamUrl, { method: 'POST', keepalive: true }) : stopStream(currentCamera.id);
      }
    };

    const handleBeforeUnload = () => handleCleanup(true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleCleanup(false); // Cleanup on component unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // This effect should only run once on mount and unmount

  const handleSelectCamera = async (camera: Camera) => {
    setStreamError(null);
    setRecordingStatus('idle'); // Reset recording status on any camera change

    // If a recording is in progress, stop it before changing streams
    if (recordingStatus === 'recording' && selectedCamera) {
      await stopRecording(selectedCamera.id);
    }

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

  const handleStartRecording = async () => {
    if (!selectedCamera) return;
    try {
      await startRecording(selectedCamera.id);
      setRecordingStatus('recording');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setStreamError('Failed to start recording.'); // Reuse stream error state for simplicity
    }
  };

  const handleStopRecording = async () => {
    if (!selectedCamera) return;
    try {
      await stopRecording(selectedCamera.id);
      setRecordingStatus('idle');
      setRecordingListVersion(v => v + 1); // Trigger list refresh
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setStreamError('Failed to stop recording.');
    }
  };
  const handlePlayRecording = (filename: string) => {
    const url = `${BACKEND_URL}/recordings/${filename}`;
    setPlayingRecordingUrl(url);
    setIsPlaybackModalOpen(true);
  };

  const handleClosePlaybackModal = () => {
    setIsPlaybackModalOpen(false);
    setPlayingRecordingUrl(null);
  };

  const handleCameraAdded = () => {
    // Refetch the camera list
    fetchCameras();
  };

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ONVIF Web Viewer
          </Typography>
        </Toolbar>
      </AppBar>
      <main>
        <Container sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" component="h1">
              Cameras
            </Typography>
            <Button variant="contained" onClick={() => setIsAddCameraModalOpen(true)}>
              Add Camera
            </Button>
          </Box>
          <CameraList
            cameras={cameras}
            loading={camerasLoading}
            error={camerasError}
            onSelectCamera={handleSelectCamera}
          />

          {selectedCamera && (
            <Box sx={{ mt: 4, p: 2, border: '1px solid grey', borderRadius: '4px' }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Live Stream: {selectedCamera.name}
              </Typography>
              {isLoadingStream ? (
                <CircularProgress />
              ) : streamError ? (
                <Alert severity="error">{streamError}</Alert>
              ) : streamUrl ? (
                <>
                  <VideoPlayer streamUrl={streamUrl} />
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {recordingStatus === 'idle' ? (
                      <Button variant="contained" color="primary" onClick={handleStartRecording}>
                        Start Recording
                      </Button>
                    ) : (
                      <Button variant="contained" color="secondary" onClick={handleStopRecording}>
                        Stop Recording
                      </Button>
                    )}
                    {recordingStatus === 'recording' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={20} color="secondary" />
                        <Typography variant="body1" color="secondary">REC</Typography>
                      </Box>
                    )}
                  </Box>
                </>
              ) : null}
            </Box>
          )}

          <RecordingList listVersion={recordingListVersion} onPlayRecording={handlePlayRecording} />

        </Container>
      </main>
      <AddCameraModal
        open={isAddCameraModalOpen}
        onClose={() => setIsAddCameraModalOpen(false)}
        onCameraAdded={handleCameraAdded}
      />
      <Modal
        open={isPlaybackModalOpen}
        onClose={handleClosePlaybackModal}
        aria-labelledby="recording-playback-modal"
        aria-describedby="modal-to-play-recorded-video"
      >
        <Box sx={modalStyle}>
          {playingRecordingUrl && (
            <video src={playingRecordingUrl} controls autoPlay style={{ width: '100%' }} />
          )}
        </Box>
      </Modal>
    </>
  );
}


export default App;