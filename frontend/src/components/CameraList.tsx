import React from 'react';
import type { Camera } from '../services/api';
import { deleteCamera } from '../services/api';
import { List, ListItem, ListItemText, Button, CircularProgress, Alert, Box, Stack, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';


interface CameraListProps {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  onSelectCamera: (camera: Camera) => void;
  onCameraDeleted: (id: number) => void; // Callback to refresh the list
}

const CameraList: React.FC<CameraListProps> = ({ cameras, loading, error, onSelectCamera, onCameraDeleted }) => {

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
          cameras.map((camera) => (
            <ListItem
              key={camera.id}
              secondaryAction={
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => onSelectCamera(camera)}>
                    View Stream
                  </Button>
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(camera.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemText primary={camera.name} secondary={`Host: ${camera.host}`} />
            </ListItem>
          ))
        )}
      </List>
    </Box>
  );
};

export default CameraList;
