
import React, { useState } from 'react';
import {
  Modal,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { addCamera, syncCameraTime, discoverUVCCameras, type NewCamera, type UVCDevice } from '../services/api';

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
  maxHeight: '90vh',
  overflowY: 'auto',
};

interface AddCameraModalProps {
  open: boolean;
  onClose: () => void;
  onCameraAdded: () => void;
}

const AddCameraModal: React.FC<AddCameraModalProps> = ({ open, onClose, onCameraAdded }) => {
  const [cameraType, setCameraType] = useState<'onvif' | 'uvc'>('onvif');
  const [name, setName] = useState('');

  // ONVIF fields
  const [host, setHost] = useState('');
  const [port, setPort] = useState('80');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  // UVC fields
  const [devicePath, setDevicePath] = useState('');
  const [uvcDevices, setUvcDevices] = useState<UVCDevice[]>([]);
  const [discoveringUVC, setDiscoveringUVC] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (event: SelectChangeEvent<'onvif' | 'uvc'>) => {
    const newType = event.target.value as 'onvif' | 'uvc';
    setCameraType(newType);
    setError(null);

    // Reset form fields when switching types
    if (newType === 'uvc') {
      setHost('');
      setPort('80');
      setUser('');
      setPass('');
    } else {
      setDevicePath('');
    }
  };

  const handleDiscoverUVC = async () => {
    setDiscoveringUVC(true);
    setError(null);

    try {
      const result = await discoverUVCCameras();
      setUvcDevices(result.devices);

      if (result.devices.length === 0) {
        setError('No UVC devices found. Make sure your USB camera is connected.');
      }
    } catch (err: any) {
      console.error('Failed to discover UVC devices:', err);
      setError('Failed to discover UVC devices. Make sure you are running on Linux with V4L2 support.');
    } finally {
      setDiscoveringUVC(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let newCamera: NewCamera;

      if (cameraType === 'onvif') {
        setLoadingMessage('Testing ONVIF connection...');
        newCamera = {
          type: 'onvif',
          name,
          host,
          port: parseInt(port, 10),
          user,
          pass,
        };
      } else {
        setLoadingMessage('Testing UVC device...');
        newCamera = {
          type: 'uvc',
          name,
          device_path: devicePath,
        };
      }

      // Add the camera (backend will test connection)
      const addedCamera = await addCamera(newCamera);

      // Synchronize time only for ONVIF cameras
      if (cameraType === 'onvif') {
        setLoadingMessage('Synchronizing time...');
        try {
          await syncCameraTime(addedCamera.id);
          if (import.meta.env.DEV) console.log('Camera time synchronized successfully');
        } catch (syncErr: any) {
          console.warn('Failed to sync camera time:', syncErr);
          // Don't fail the entire operation if time sync fails
        }
      }

      onCameraAdded();
      handleClose();
    } catch (err: any) {
      console.error('Failed to add camera:', err);
      const message = err.response?.data?.message || 'Failed to add the camera. Please check the details and try again.';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setHost('');
    setPort('80');
    setUser('');
    setPass('');
    setDevicePath('');
    setUvcDevices([]);
    setError(null);
    setCameraType('onvif');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="add-camera-modal-title"
    >
      <Box sx={modalStyle} component="form" onSubmit={handleSubmit}>
        <Typography id="add-camera-modal-title" variant="h6" component="h2">
          Add New Camera
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <FormControl fullWidth margin="normal">
          <InputLabel id="camera-type-label">Camera Type</InputLabel>
          <Select
            labelId="camera-type-label"
            id="camera-type"
            value={cameraType}
            label="Camera Type"
            onChange={handleTypeChange}
          >
            <MenuItem value="onvif">ONVIF Network Camera</MenuItem>
            <MenuItem value="uvc">USB UVC Camera</MenuItem>
          </Select>
        </FormControl>

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

        {cameraType === 'onvif' && (
          <>
            <TextField
              margin="normal"
              required
              fullWidth
              id="host"
              label="Host or IP Address"
              name="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="port"
              label="ONVIF Port"
              name="port"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="user"
              label="Username"
              name="user"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="pass"
              label="Password"
              name="pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </>
        )}

        {cameraType === 'uvc' && (
          <>
            <Button
              onClick={handleDiscoverUVC}
              variant="outlined"
              fullWidth
              disabled={discoveringUVC}
              sx={{ mt: 2 }}
            >
              {discoveringUVC ? 'Discovering...' : 'Discover USB Cameras'}
            </Button>

            {uvcDevices.length > 0 && (
              <FormControl fullWidth margin="normal">
                <InputLabel id="device-path-label">Device</InputLabel>
                <Select
                  labelId="device-path-label"
                  id="device-path"
                  value={devicePath}
                  label="Device"
                  onChange={(e) => setDevicePath(e.target.value)}
                  required
                >
                  {uvcDevices.map((dev) => (
                    <MenuItem key={dev.device_path} value={dev.device_path}>
                      {dev.name} ({dev.device_path})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </>
        )}

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
            disabled={loading || (cameraType === 'uvc' && !devicePath)}
          >
            Test and Save
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
