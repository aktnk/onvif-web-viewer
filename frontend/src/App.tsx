import { useState, useEffect, useRef, useCallback } from 'react';
import { AppBar, Toolbar, Typography, Container, CssBaseline, Box, CircularProgress, Alert, Button, Modal } from '@mui/material';
import CameraList from './components/CameraList';
import VideoPlayer from './components/VideoPlayer';
import RecordingList from './components/RecordingList';
import AddCameraModal from './components/AddCameraModal';
import DiscoverCamerasModal from './components/DiscoverCamerasModal';
import PTZControls from './components/PTZControls';
import { getCameras, startStream, stopStream, startRecording, stopRecording, checkPTZCapabilities } from './services/api';
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

const SESSION_STORAGE_KEY = 'activeCameraIds';
const MAX_CAMERAS = 4;

// Type for active camera state
interface ActiveCameraState {
  camera: Camera;
  streamUrl: string | null;
  isLoadingStream: boolean;
  streamError: string | null;
  recordingStatus: 'idle' | 'recording';
  hasPTZ: boolean;
  checkingPTZ: boolean;
}

function App() {
  // State for camera list
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [camerasLoading, setCamerasLoading] = useState<boolean>(true);
  const [camerasError, setCamerasError] = useState<string | null>(null);

  // State for active cameras (up to 4)
  const [activeCameras, setActiveCameras] = useState<Map<number, ActiveCameraState>>(new Map());

  // State for playback modal
  const [isPlaybackModalOpen, setIsPlaybackModalOpen] = useState(false);
  const [playingRecordingUrl, setPlayingRecordingUrl] = useState<string | null>(null);

  // State for Add Camera Modal
  const [isAddCameraModalOpen, setIsAddCameraModalOpen] = useState(false);

  // State for Discover Cameras Modal
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);

  // State to trigger recording list refresh
  const [recordingListVersion, setRecordingListVersion] = useState(0);

  const BACKEND_URL = 'http://localhost:3001';
  // Using a ref to give cleanup effects access to the latest state
  const stateRef = useRef({ activeCameras });
  useEffect(() => {
    stateRef.current = { activeCameras };
  });

  const fetchCameras = useCallback(async (cameraIdsToRestore?: number[]) => {
    try {
      setCamerasLoading(true);
      const camerasData = await getCameras();
      setCameras(camerasData);
      setCamerasError(null);

      if (cameraIdsToRestore && cameraIdsToRestore.length > 0) {
        cameraIdsToRestore.forEach(cameraId => {
          const cameraToRestore = camerasData.find(c => c.id === cameraId);
          if (cameraToRestore) {
            console.log(`Restoring stream for camera: ${cameraToRestore.name}`);
            // Use timeout to ensure state updates are processed before starting stream
            setTimeout(() => handleSelectCamera(cameraToRestore), 0);
          }
        });
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
    const savedCameraIds = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const idsToRestore = savedCameraIds ? JSON.parse(savedCameraIds) : undefined;
    fetchCameras(idsToRestore);
  }, [fetchCameras]);


  // Effect to handle cleanup on unmount or page unload
  useEffect(() => {
    const handleCleanup = (isUnloading = false) => {
      const { activeCameras: currentActiveCameras } = stateRef.current;
      currentActiveCameras.forEach((cameraState, cameraId) => {
        if (cameraState.recordingStatus === 'recording') {
          const stopRecUrl = `${BACKEND_URL}/api/cameras/${cameraId}/recording/stop`;
          isUnloading ? fetch(stopRecUrl, { method: 'POST', keepalive: true }) : stopRecording(cameraId);
        }
        const stopStreamUrl = `${BACKEND_URL}/api/cameras/${cameraId}/stream/stop`;
        isUnloading ? fetch(stopStreamUrl, { method: 'POST', keepalive: true }) : stopStream(cameraId);
      });
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
    const cameraId = camera.id;

    // Check if camera is already active - if so, remove it
    if (activeCameras.has(cameraId)) {
      const cameraState = activeCameras.get(cameraId)!;

      // Stop recording if active
      if (cameraState.recordingStatus === 'recording') {
        await stopRecording(cameraId);
      }

      // Stop stream
      await stopStream(cameraId);

      // Remove from active cameras
      setActiveCameras(prev => {
        const newMap = new Map(prev);
        newMap.delete(cameraId);

        // Update session storage
        const activeCameraIds = Array.from(newMap.keys());
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(activeCameraIds));

        return newMap;
      });

      return;
    }

    // Check if we've reached the max cameras limit
    if (activeCameras.size >= MAX_CAMERAS) {
      alert(`Maximum of ${MAX_CAMERAS} cameras can be displayed simultaneously.`);
      return;
    }

    // Initialize camera state
    setActiveCameras(prev => {
      const newMap = new Map(prev);
      newMap.set(cameraId, {
        camera,
        streamUrl: null,
        isLoadingStream: true,
        streamError: null,
        recordingStatus: 'idle',
        hasPTZ: false,
        checkingPTZ: false,
      });
      return newMap;
    });

    try {
      const data = await startStream(cameraId);
      const fullStreamUrl = `${BACKEND_URL}${data.streamUrl}`;
      console.log(`Stream process started. Polling for manifest at: ${fullStreamUrl}`);

      await pollForStream(fullStreamUrl);

      // Update stream URL
      setActiveCameras(prev => {
        const newMap = new Map(prev);
        const cameraState = newMap.get(cameraId);
        if (cameraState) {
          newMap.set(cameraId, {
            ...cameraState,
            streamUrl: fullStreamUrl,
            isLoadingStream: false,
          });
        }

        // Update session storage
        const activeCameraIds = Array.from(newMap.keys());
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(activeCameraIds));

        return newMap;
      });

      // Check PTZ capabilities after stream is ready
      setActiveCameras(prev => {
        const newMap = new Map(prev);
        const cameraState = newMap.get(cameraId);
        if (cameraState) {
          newMap.set(cameraId, {
            ...cameraState,
            checkingPTZ: true,
          });
        }
        return newMap;
      });

      try {
        console.log(`Checking PTZ capabilities for camera ${cameraId}...`);
        const ptzCapabilities = await checkPTZCapabilities(cameraId);
        console.log('PTZ capabilities response:', ptzCapabilities);

        setActiveCameras(prev => {
          const newMap = new Map(prev);
          const cameraState = newMap.get(cameraId);
          if (cameraState) {
            newMap.set(cameraId, {
              ...cameraState,
              hasPTZ: ptzCapabilities.supported,
              checkingPTZ: false,
            });
          }
          return newMap;
        });

        if (ptzCapabilities.supported) {
          console.log('PTZ is supported! Showing controls.');
        } else {
          console.log('PTZ is not supported for this camera.');
        }
      } catch (ptzError: any) {
        console.error('Failed to check PTZ capabilities:', ptzError);
        console.error('Error details:', ptzError.response?.data || ptzError.message);

        setActiveCameras(prev => {
          const newMap = new Map(prev);
          const cameraState = newMap.get(cameraId);
          if (cameraState) {
            newMap.set(cameraId, {
              ...cameraState,
              hasPTZ: false,
              checkingPTZ: false,
            });
          }
          return newMap;
        });
      }

    } catch (error) {
      console.error('Failed to start or poll for stream:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please check the backend logs.';

      setActiveCameras(prev => {
        const newMap = new Map(prev);
        const cameraState = newMap.get(cameraId);
        if (cameraState) {
          newMap.set(cameraId, {
            ...cameraState,
            streamError: `Failed to start stream. ${errorMessage}`,
            isLoadingStream: false,
          });
        }
        return newMap;
      });
    }
  };

  const handleStartRecording = async (cameraId: number) => {
    try {
      await startRecording(cameraId);

      setActiveCameras(prev => {
        const newMap = new Map(prev);
        const cameraState = newMap.get(cameraId);
        if (cameraState) {
          newMap.set(cameraId, {
            ...cameraState,
            recordingStatus: 'recording',
          });
        }
        return newMap;
      });
    } catch (error) {
      console.error('Failed to start recording:', error);

      setActiveCameras(prev => {
        const newMap = new Map(prev);
        const cameraState = newMap.get(cameraId);
        if (cameraState) {
          newMap.set(cameraId, {
            ...cameraState,
            streamError: 'Failed to start recording.',
          });
        }
        return newMap;
      });
    }
  };

  const handleStopRecording = async (cameraId: number) => {
    try {
      console.log(`[App] Stopping recording for camera ${cameraId}...`);
      await stopRecording(cameraId);
      console.log(`[App] Recording stopped for camera ${cameraId}`);

      setActiveCameras(prev => {
        const newMap = new Map(prev);
        const cameraState = newMap.get(cameraId);
        if (cameraState) {
          newMap.set(cameraId, {
            ...cameraState,
            recordingStatus: 'idle',
          });
        }
        return newMap;
      });

      console.log(`[App] Triggering recording list refresh...`);
      setRecordingListVersion(v => {
        const newVersion = v + 1;
        console.log(`[App] Recording list version updated: ${v} -> ${newVersion}`);
        return newVersion;
      });
    } catch (error) {
      console.error('Failed to stop recording:', error);

      setActiveCameras(prev => {
        const newMap = new Map(prev);
        const cameraState = newMap.get(cameraId);
        if (cameraState) {
          newMap.set(cameraId, {
            ...cameraState,
            streamError: 'Failed to stop recording.',
          });
        }
        return newMap;
      });
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

  const handleCameraDeleted = async (deletedCameraId: number) => {
    // If the deleted camera is currently active, deselect it
    if (activeCameras.has(deletedCameraId)) {
      const cameraState = activeCameras.get(deletedCameraId)!;

      // Stop recording if active
      if (cameraState.recordingStatus === 'recording') {
        await stopRecording(deletedCameraId);
      }

      // Stop stream
      await stopStream(deletedCameraId);

      // Remove from active cameras
      setActiveCameras(prev => {
        const newMap = new Map(prev);
        newMap.delete(deletedCameraId);

        // Update session storage
        const activeCameraIds = Array.from(newMap.keys());
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(activeCameraIds));

        return newMap;
      });
    }

    // Refetch the camera list to remove the deleted one
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
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" onClick={() => setIsDiscoverModalOpen(true)}>
                Discover Cameras
              </Button>
              <Button variant="contained" onClick={() => setIsAddCameraModalOpen(true)}>
                Add Camera
              </Button>
            </Box>
          </Box>
          <CameraList
            cameras={cameras}
            loading={camerasLoading}
            error={camerasError}
            activeCameraIds={Array.from(activeCameras.keys())}
            onSelectCamera={handleSelectCamera}
            onCameraDeleted={handleCameraDeleted}
          />

          {activeCameras.size > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Live Streams ({activeCameras.size}/{MAX_CAMERAS})
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                  mt: 2,
                }}
              >
                {Array.from(activeCameras.entries()).map(([cameraId, cameraState]) => (
                  <Box
                    key={cameraId}
                    sx={{
                      p: 2,
                      border: '1px solid grey',
                      borderRadius: '4px',
                      backgroundColor: 'background.paper',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6" component="h3">
                        {cameraState.camera.name}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleSelectCamera(cameraState.camera)}
                      >
                        Close
                      </Button>
                    </Box>

                    {cameraState.isLoadingStream ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                        <CircularProgress />
                      </Box>
                    ) : cameraState.streamError ? (
                      <Alert severity="error">{cameraState.streamError}</Alert>
                    ) : cameraState.streamUrl ? (
                      <>
                        <VideoPlayer streamUrl={cameraState.streamUrl} />
                        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                          {cameraState.recordingStatus === 'idle' ? (
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={() => handleStartRecording(cameraId)}
                            >
                              Start Recording
                            </Button>
                          ) : (
                            <Button
                              variant="contained"
                              color="secondary"
                              size="small"
                              onClick={() => handleStopRecording(cameraId)}
                            >
                              Stop Recording
                            </Button>
                          )}
                          {cameraState.recordingStatus === 'recording' && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={16} color="secondary" />
                              <Typography variant="body2" color="secondary">REC</Typography>
                            </Box>
                          )}
                        </Box>
                        {cameraState.checkingPTZ ? (
                          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="caption">Checking PTZ capabilities...</Typography>
                          </Box>
                        ) : cameraState.hasPTZ ? (
                          <PTZControls cameraId={cameraId} />
                        ) : null}
                      </>
                    ) : null}
                  </Box>
                ))}
              </Box>
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
      <DiscoverCamerasModal
        open={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
        onCameraAdded={handleCameraAdded}
        registeredCameras={cameras}
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