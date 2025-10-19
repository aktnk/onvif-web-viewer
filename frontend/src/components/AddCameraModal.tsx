
import React, { useState } from 'react';
import { Modal, Box, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { addCamera, type NewCamera } from '../services/api';

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
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('80');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const newCamera: NewCamera = {
      name,
      host,
      port: parseInt(port, 10),
      user,
      pass,
    };

    try {
      await addCamera(newCamera);
      onCameraAdded();
      onClose();
      // Reset form
      setName('');
      setHost('');
      setPort('80');
      setUser('');
      setPass('');
    } catch (err: any) {
      console.error('Failed to add camera:', err);
      const message = err.response?.data?.message || 'Failed to connect to the camera. Please check the details and try again.';
      setError(message);
    } finally {
      setLoading(false);
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
        <Box sx={{ mt: 2, position: 'relative' }}>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
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
