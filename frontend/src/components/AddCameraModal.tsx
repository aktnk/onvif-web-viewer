
import React, { useState } from 'react';
import {
  Modal, Box, Typography, TextField, Button, CircularProgress, Alert,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { addCamera, syncCameraTime, type NewCamera } from '../services/api';

const modalStyle = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

interface AddCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCameraAdded: () => void;
}

const AddCameraModal: React.FC<AddCameraModalProps> = ({ open, onClose, onCameraAdded }) => {
  const [cameraType, setCameraType] = useState<'onvif' | 'rtsp'>('onvif');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('80');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [streamPath, setStreamPath] = useState('/');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (_event: React.MouseEvent<HTMLElement>, newType: 'onvif' | 'rtsp' | null) => {
    if (newType !== null) {
      setCameraType(newType);
      // Adjust default port based on camera type
      if (newType === 'onvif') {
        setPort('80');
      } else if (newType === 'rtsp') {
        setPort('8554');
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setLoadingMessage(cameraType === 'onvif' ? 'Testing connection...' : 'Saving camera...');

    const newCamera: NewCamera = {
      name,
      type: cameraType,
      host,
      port: parseInt(port, 10),
    };

    // Add credentials if provided
    if (user) newCamera.user = user;
    if (pass) newCamera.pass = pass;

    // Add type-specific fields
    if (cameraType === 'rtsp' && streamPath) {
      newCamera.stream_path = streamPath;
    }

    try {
      // Add the camera
      const addedCamera = await addCamera(newCamera);

      // Synchronize time only for ONVIF cameras
      if (cameraType === 'onvif') {
        setLoadingMessage('Synchronizing time...');
        try {
          await syncCameraTime(addedCamera.id);
          console.log('Camera time synchronized successfully');
        } catch (syncErr: any) {
          console.warn('Failed to sync camera time:', syncErr);
          // Don't fail the entire operation if time sync fails
        }
      }

      onCameraAdded();
      onClose();
      // Reset form
      setName('');
      setHost('');
      setPort(cameraType === 'rtsp' ? '8554' : '80');
      setUser('');
      setPass('');
      setStreamPath('/');
    } catch (err: any) {
      console.error('Failed to add camera:', err);
      const message = err.response?.data?.message || 'Failed to add the camera. Please check the details and try again.';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="add-camera-modal-title"
    >
      <Box sx={modalStyle} component="form" onSubmit={handleSubmit}>
        <Typography id="add-camera-modal-title" variant="h6" component="h2">
          Add New Camera
        </Typography>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {/* Camera Type Selection */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Camera Type
          </Typography>
          <ToggleButtonGroup
            value={cameraType}
            exclusive
            onChange={handleTypeChange}
            aria-label="camera type"
            fullWidth
          >
            <ToggleButton value="onvif" aria-label="ONVIF camera">
              ONVIF Camera
            </ToggleButton>
            <ToggleButton value="rtsp" aria-label="RTSP camera">
              RTSP Camera
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <TextField
          margin="normal"
          required
          fullWidth
          id="name"
          label="Camera Name"
          name="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          id="host"
          label={cameraType === 'onvif' ? 'Host or IP Address' : 'RTSP Server Host'}
          name="host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          id="port"
          label={cameraType === 'onvif' ? 'ONVIF Port' : 'RTSP Server Port'}
          name="port"
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
        />

        {/* RTSP-specific field */}
        {cameraType === 'rtsp' && (
          <TextField
            margin="normal"
            fullWidth
            id="streamPath"
            label="Stream Path"
            name="streamPath"
            placeholder="/"
            helperText="e.g., / or /uvc_camera_1"
            value={streamPath}
            onChange={(e) => setStreamPath(e.target.value)}
          />
        )}

        <TextField
          margin="normal"
          fullWidth
          id="user"
          label="Username (optional)"
          name="user"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <TextField
          margin="normal"
          fullWidth
          id="pass"
          label="Password (optional)"
          name="pass"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        {loading && loadingMessage && (
          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
            {loadingMessage}
          </Typography>
        )}

        <Box sx={{ mt: 2, position: 'relative' }}>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
          >
            {cameraType === 'onvif' ? 'Test and Save' : 'Save'}
          </Button>
          {loading && (
            <CircularProgress
              size={24}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px',
              }}
            />
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default AddCameraModal;
