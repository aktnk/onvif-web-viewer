import React from 'react';
import type { Camera } from '../services/api';
import { List, ListItem, ListItemText, Button, CircularProgress, Alert, Box } from '@mui/material';

interface CameraListProps {
  cameras: Camera[];
  loading: boolean;
  error: string | null;
  onSelectCamera: (camera: Camera) => void;
}

const CameraList: React.FC<CameraListProps> = ({ cameras, loading, error, onSelectCamera }) => {

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
            <ListItemText primary="No cameras found. Please add cameras via the backend API." />
          </ListItem>
        ) : (
          cameras.map((camera) => (
            <ListItem
              key={camera.id}
              secondaryAction={
                <Button variant="contained" onClick={() => onSelectCamera(camera)}>
                  View Stream
                </Button>
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
