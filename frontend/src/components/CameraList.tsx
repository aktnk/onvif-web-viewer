import React, { useEffect, useState } from 'react';
import { getCameras, type Camera } from '../services/api';
import { List, ListItem, ListItemText, Button, CircularProgress, Alert, Box } from '@mui/material';

interface CameraListProps {
  onSelectCamera: (camera: Camera) => void;
}

const CameraList: React.FC<CameraListProps> = ({ onSelectCamera }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        setLoading(true);
        const data = await getCameras();
        setCameras(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch cameras. Is the backend server running?');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCameras();
  }, []);

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
