import React, { useState } from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { discoverCameras, addCamera, type DiscoveredDevice } from '../services/api';

const modalStyle = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80vw',
  maxWidth: 800,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  maxHeight: '90vh',
  overflow: 'auto',
};

interface DiscoverCamerasModalProps {
  open: boolean;
  onClose: () => void;
  onCameraAdded: () => void;
}

const DiscoverCamerasModal: React.FC<DiscoverCamerasModalProps> = ({ open, onClose, onCameraAdded }) => {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState({ user: '', pass: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setError(null);
    setDevices([]);

    try {
      const discoveredDevices = await discoverCameras();
      setDevices(discoveredDevices);
      if (discoveredDevices.length === 0) {
        setError('No ONVIF cameras found on the network. If you know the camera IP address, use "Add Camera" instead.');
      }
    } catch (err: any) {
      console.error('Discovery error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to discover cameras. Please check the backend server.';
      setError(errorMsg);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSelectDevice = (device: DiscoveredDevice) => {
    setSelectedDevice(device);
    setCredentials({ user: '', pass: '' });
    setAddError(null);
    setIsAddDialogOpen(true);
  };

  const handleAddCamera = async () => {
    if (!selectedDevice) return;

    setIsAdding(true);
    setAddError(null);

    try {
      await addCamera({
        name: selectedDevice.name,
        host: selectedDevice.address,
        port: selectedDevice.port,
        user: credentials.user,
        pass: credentials.pass,
      });

      // Success
      setIsAddDialogOpen(false);
      onCameraAdded();
      // Remove the added device from the list
      setDevices(prevDevices => prevDevices.filter(d => d.address !== selectedDevice.address));
    } catch (err: any) {
      console.error('Add camera error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to add camera. Please check credentials.';
      setAddError(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedDevice(null);
    setCredentials({ user: '', pass: '' });
    setAddError(null);
  };

  const handleModalClose = () => {
    setDevices([]);
    setError(null);
    setIsDiscovering(false);
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={handleModalClose} aria-labelledby="discover-cameras-modal">
        <Box sx={modalStyle}>
          <Typography id="discover-cameras-modal" variant="h6" component="h2" gutterBottom>
            Discover ONVIF Cameras
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Scan your local network (subnet) for ONVIF-compliant cameras. This will scan 254 IP addresses and may take 2-3 minutes.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            This scan uses unicast probes to detect cameras that don't respond to multicast discovery.
          </Alert>

          <Button
            variant="contained"
            onClick={handleDiscover}
            disabled={isDiscovering}
            fullWidth
            sx={{ mb: 2 }}
          >
            {isDiscovering ? 'Scanning Network...' : 'Start Discovery'}
          </Button>

          {isDiscovering && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 2 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Scanning network... This may take 2-3 minutes.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Please be patient while we probe each IP address.
              </Typography>
            </Box>
          )}

          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {devices.length > 0 && (
            <>
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Found {devices.length} device(s):
              </Typography>
              <List sx={{ bgcolor: 'background.paper', border: '1px solid #ccc', borderRadius: 1 }}>
                {devices.map((device, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <Button variant="outlined" size="small" onClick={() => handleSelectDevice(device)}>
                        Add
                      </Button>
                    }
                  >
                    <ListItemText
                      primary={`${device.name} (${device.manufacturer})`}
                      secondary={`${device.address}:${device.port}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button onClick={handleModalClose} variant="outlined">
              Close
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Add Camera Dialog */}
      <Dialog open={isAddDialogOpen} onClose={handleCloseAddDialog}>
        <DialogTitle>Add Camera</DialogTitle>
        <DialogContent>
          {selectedDevice && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Camera: <strong>{selectedDevice.name}</strong> at {selectedDevice.address}:{selectedDevice.port}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Enter the camera's ONVIF credentials:
              </Typography>
              <TextField
                label="Username"
                fullWidth
                margin="normal"
                value={credentials.user}
                onChange={(e) => setCredentials({ ...credentials, user: e.target.value })}
                disabled={isAdding}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                margin="normal"
                value={credentials.pass}
                onChange={(e) => setCredentials({ ...credentials, pass: e.target.value })}
                disabled={isAdding}
              />
              {addError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {addError}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleAddCamera}
            variant="contained"
            disabled={isAdding || !credentials.user || !credentials.pass}
          >
            {isAdding ? 'Adding...' : 'Add Camera'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DiscoverCamerasModal;
