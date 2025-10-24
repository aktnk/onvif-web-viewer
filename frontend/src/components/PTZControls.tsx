import React, { useState } from 'react';
import { Box, IconButton, Typography, Paper, Slider, Stack } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { movePTZ, stopPTZ } from '../services/api';

interface PTZControlsProps {
  cameraId: number;
}

const PTZControls: React.FC<PTZControlsProps> = ({ cameraId }) => {
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(0);

  console.log('[PTZControls] Rendering PTZ controls for camera:', cameraId);

  const handleMove = async (x: number, y: number, zoom: number, buttonId: string) => {
    console.log(`[PTZControls] Moving ${buttonId}:`, { x, y, zoom });
    setActiveButton(buttonId);
    try {
      await movePTZ(cameraId, { x, y, zoom });
      console.log('[PTZControls] Move command sent successfully');
    } catch (error: any) {
      console.error('[PTZControls] Failed to move PTZ:', error);
      console.error('[PTZControls] Error details:', error.response?.data || error.message);
    }
  };

  const handleStop = async () => {
    setActiveButton(null);
    try {
      await stopPTZ(cameraId);
    } catch (error) {
      console.error('Failed to stop PTZ:', error);
    }
  };

  const handleZoomChange = async (_event: Event, newValue: number | number[]) => {
    const zoom = newValue as number;
    setZoomLevel(zoom);
    try {
      await movePTZ(cameraId, { x: 0, y: 0, zoom: zoom / 100 });
    } catch (error) {
      console.error('Failed to zoom:', error);
    }
  };

  const handleZoomCommitted = async () => {
    // Stop zoom when user releases the slider
    setZoomLevel(0);
    try {
      await stopPTZ(cameraId);
    } catch (error) {
      console.error('Failed to stop zoom:', error);
    }
  };

  const buttonStyle = (buttonId: string) => ({
    opacity: activeButton === buttonId ? 0.6 : 1,
    transition: 'opacity 0.2s'
  });

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        PTZ Control
      </Typography>

      {/* Pan/Tilt Controls */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        <IconButton
          size="large"
          onMouseDown={() => handleMove(0, 0.5, 0, 'up')}
          onMouseUp={handleStop}
          onMouseLeave={handleStop}
          onTouchStart={() => handleMove(0, 0.5, 0, 'up')}
          onTouchEnd={handleStop}
          sx={buttonStyle('up')}
          aria-label="tilt up"
        >
          <ArrowUpwardIcon fontSize="large" />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="large"
            onMouseDown={() => handleMove(-0.5, 0, 0, 'left')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove(-0.5, 0, 0, 'left')}
            onTouchEnd={handleStop}
            sx={buttonStyle('left')}
            aria-label="pan left"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box
            sx={{
              width: 60,
              height: 60,
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              PTZ
            </Typography>
          </Box>
          <IconButton
            size="large"
            onMouseDown={() => handleMove(0.5, 0, 0, 'right')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove(0.5, 0, 0, 'right')}
            onTouchEnd={handleStop}
            sx={buttonStyle('right')}
            aria-label="pan right"
          >
            <ArrowForwardIcon fontSize="large" />
          </IconButton>
        </Box>
        <IconButton
          size="large"
          onMouseDown={() => handleMove(0, -0.5, 0, 'down')}
          onMouseUp={handleStop}
          onMouseLeave={handleStop}
          onTouchStart={() => handleMove(0, -0.5, 0, 'down')}
          onTouchEnd={handleStop}
          sx={buttonStyle('down')}
          aria-label="tilt down"
        >
          <ArrowDownwardIcon fontSize="large" />
        </IconButton>
      </Box>

      {/* Zoom Controls */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" gutterBottom>
          Zoom
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton
            onMouseDown={() => handleMove(0, 0, -0.5, 'zoomOut')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove(0, 0, -0.5, 'zoomOut')}
            onTouchEnd={handleStop}
            sx={buttonStyle('zoomOut')}
            aria-label="zoom out"
          >
            <ZoomOutIcon />
          </IconButton>
          <Slider
            value={zoomLevel}
            onChange={handleZoomChange}
            onChangeCommitted={handleZoomCommitted}
            min={-100}
            max={100}
            step={10}
            valueLabelDisplay="auto"
            sx={{ flex: 1 }}
          />
          <IconButton
            onMouseDown={() => handleMove(0, 0, 0.5, 'zoomIn')}
            onMouseUp={handleStop}
            onMouseLeave={handleStop}
            onTouchStart={() => handleMove(0, 0, 0.5, 'zoomIn')}
            onTouchEnd={handleStop}
            sx={buttonStyle('zoomIn')}
            aria-label="zoom in"
          >
            <ZoomInIcon />
          </IconButton>
        </Stack>
      </Box>
    </Paper>
  );
};

export default PTZControls;
