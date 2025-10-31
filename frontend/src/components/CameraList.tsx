import React, { useState } from 'react';
import type { Camera } from '../services/api';
import { deleteCamera, syncCameraTime } from '../services/api';
import { List, ListItem, ListItemText, Button, CircularProgress, Alert, Box, Stack, IconButton, Snackbar } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SyncIcon from '@mui/icons-material/Sync';


interface CameraListProps {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  activeCameraIds: number[];
  onSelectCamera: (camera: Camera) => void;
  onCameraDeleted: (id: number) => void; // Callback to refresh the list
}

const CameraList: React.FC<CameraListProps> = ({ cameras, loading, error, activeCameraIds, onSelectCamera, onCameraDeleted }) => {
  const [syncingCameraId, setSyncingCameraId] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this camera?')) {
      try {
        await deleteCamera(id);
        onCameraDeleted(id); // Notify parent to refresh
      } catch (err) {
        console.error('Failed to delete camera', err);
        alert('Failed to delete camera. See console for details.');
      }
    }
  };

  const handleSyncTime = async (id: number) => {
    setSyncingCameraId(id);
    try {
      const result = await syncCameraTime(id);
      setSnackbarMessage(result.message || 'Camera time synchronized successfully');
      setSnackbarOpen(true);
    } catch (err: any) {
      console.error('Failed to sync camera time', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to sync camera time';
      setSnackbarMessage(`Error: ${errorMessage}`);
      setSnackbarOpen(true);
    } finally {
      setSyncingCameraId(null);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <List>
        {cameras.length === 0 ? (
          <ListItem>
            <ListItemText primary="No cameras found. Click 'Add Camera' to get started." />
          </ListItem>
        ) : (
          cameras.map((camera) => {
            const isActive = activeCameraIds.includes(camera.id);
            return (
              <ListItem
                key={camera.id}
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color={isActive ? "secondary" : "primary"}
                      onClick={() => onSelectCamera(camera)}
                    >
                      {isActive ? 'ストリーム停止' : 'ストリーム表示'}
                    </Button>
                    <IconButton
                      edge="end"
                      aria-label="sync time"
                      onClick={() => handleSyncTime(camera.id)}
                      disabled={syncingCameraId === camera.id}
                      title="Sync camera time with server"
                    >
                      {syncingCameraId === camera.id ? (
                        <CircularProgress size={24} />
                      ) : (
                        <SyncIcon />
                      )}
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleDelete(camera.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText primary={camera.name} secondary={`Host: ${camera.host}`} />
              </ListItem>
            );
          })
        )}
      </List>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default CameraList;
