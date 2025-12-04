# UVC Camera RTSP Server Setup with MediaMTX

This guide explains how to set up UVC (USB Video Class) cameras with simultaneous streaming and recording capabilities using MediaMTX as an RTSP server.

## Overview

To use UVC cameras with simultaneous streaming and recording (camera type: `rtsp`), you need to set up an RTSP server that streams from your USB camera device. This guide focuses on MediaMTX, the recommended solution.

**Why MediaMTX?**
- Lightweight and modern RTSP/RTMP/HLS server
- Excellent UVC camera support
- Allows simultaneous streaming AND recording (no V4L2 device exclusivity)
- Cross-platform support
- Automatic process restart on failure
- Multi-client support

## Installation

### Linux

Download and install the latest MediaMTX binary:

```bash
# Download latest release (automatic version detection)
MEDIAMTX_VERSION=$(curl -s https://api.github.com/repos/bluenviron/mediamtx/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
wget "https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/mediamtx_${MEDIAMTX_VERSION}_linux_amd64.tar.gz"
tar -xzf "mediamtx_${MEDIAMTX_VERSION}_linux_amd64.tar.gz"
sudo mv mediamtx /usr/local/bin/
sudo chmod +x /usr/local/bin/mediamtx

# Or simply download the binary directly:
# wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_linux_amd64.tar.gz
# tar -xzf mediamtx_linux_amd64.tar.gz

# Create configuration directory
sudo mkdir -p /etc/mediamtx
```

For other platforms, check the [MediaMTX releases page](https://github.com/bluenviron/mediamtx/releases).

## Configuration

Create the MediaMTX configuration file at `/etc/mediamtx/mediamtx.yml`:

```yaml
# General server settings
rtspAddress: :8554

# Define paths for each UVC camera
paths:
  # Example 1: MJPEG camera (tested and working)
  uvc_camera_1:
    runOnInit: >
      ffmpeg -f v4l2 -input_format mjpeg -video_size 1280x720 -framerate 30
      -i /dev/video0 -c:v libx264 -preset ultrafast -an
      -f rtsp rtsp://localhost:$RTSP_PORT/$MTX_PATH
    runOnInitRestart: yes

  # Example 2: H.264 camera (can use copy codec)
  uvc_camera_2:
    runOnInit: >
      ffmpeg -f v4l2 -input_format h264 -video_size 1920x1080 -framerate 30
      -i /dev/video0 -c:v copy -an
      -f rtsp rtsp://localhost:$RTSP_PORT/$MTX_PATH
    runOnInitRestart: yes

  # Example 3: YUYV/raw format camera (needs encoding)
  uvc_camera_3:
    runOnInit: >
      ffmpeg -f v4l2 -video_size 1280x720 -framerate 30
      -i /dev/video2 -c:v libx264 -preset ultrafast -tune zerolatency -b:v 2M -an
      -f rtsp rtsp://localhost:$RTSP_PORT/$MTX_PATH
    runOnInitRestart: yes
```

### Configuration Notes

- **`runOnInit`**: Starts the FFmpeg process when MediaMTX launches
- **`runOnInitRestart: yes`**: Automatically restarts FFmpeg if it crashes
- **`$RTSP_PORT`** and **`$MTX_PATH`**: MediaMTX variables that are automatically expanded
- **Device selection**: Change `/dev/video0` to match your camera device
- **Format selection**: Check supported formats with: `v4l2-ctl --device=/dev/video0 --list-formats-ext`
- **Codec choice**:
  - H.264 cameras: Use `-c:v copy` for low CPU usage
  - Other formats: Use `-c:v libx264` (requires encoding, higher CPU usage)

## Running MediaMTX

### Foreground (for testing)

```bash
mediamtx /etc/mediamtx/mediamtx.yml
```

### Background Service (recommended for production)

Create a systemd service:

```bash
sudo tee /etc/systemd/system/mediamtx.service > /dev/null <<EOF
[Unit]
Description=MediaMTX RTSP Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/mediamtx /etc/mediamtx/mediamtx.yml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mediamtx
sudo systemctl start mediamtx
```

Check the service status:

```bash
sudo systemctl status mediamtx
```

## Adding Camera to the Application

Once MediaMTX is running:

1. Open the web application and click **"Add Camera"**
2. Select camera type: **"RTSP Camera"**
3. Fill in the fields:
   - **Name**: Any descriptive name (e.g., "USB Camera 1")
   - **RTSP Server Host**: `localhost` (or the IP of the machine running MediaMTX)
   - **RTSP Server Port**: `8554` (MediaMTX default)
   - **Stream Path**: `/uvc_camera_1` (must match the path name in mediamtx.yml)
   - **Username/Password**: Leave empty unless you configured authentication in MediaMTX
4. Click **"Test and Save"**

**RTSP URL Format:**
```
rtsp://localhost:8554/uvc_camera_1
```

## Troubleshooting

### Check UVC Device Capabilities

```bash
v4l2-ctl --device=/dev/video0 --list-formats-ext
```

### Test RTSP Stream

Use VLC or FFplay to verify the stream:

```bash
ffplay rtsp://localhost:8554/uvc_camera_1
```

### Check MediaMTX Logs

```bash
sudo journalctl -u mediamtx -f
```

### Common Issues

#### "Device busy"
Another process is using the V4L2 device. Stop it before starting MediaMTX.

**Solution:**
```bash
# Find processes using the device
sudo lsof /dev/video0

# Kill the process if needed
sudo kill -9 <PID>
```

#### "Permission denied"
Your user needs to be in the `video` group.

**Solution:**
```bash
sudo usermod -a -G video $USER
# Logout and login for changes to take effect
```

#### "Format not supported"
The specified input format is not supported by your camera.

**Solution:**
Check supported formats and adjust the MediaMTX configuration:
```bash
v4l2-ctl --device=/dev/video0 --list-formats-ext
```

#### Frozen/Stuttering Video in Browser
The RTSP stream lacks proper keyframes for HLS playback.

**Solution:**
The application uses libx264 re-encoding with `-g 30` keyframe interval. If issues persist:
- Ensure MediaMTX config uses `-c:v libx264` (not `-c:v copy`)
- Add `-g 30` parameter to FFmpeg command in MediaMTX config

#### Recording List Not Updating
The application waits 500ms after stopping recording before refreshing.

**Solution:**
- Try manually refreshing the page
- On slower systems, this delay may need to be increased in the application code

#### Stream Path Mismatch (400 Bad Request)
The `stream_path` in your camera configuration doesn't match the MediaMTX `paths` name.

**Solution:**
Ensure the stream path matches exactly:
- MediaMTX config: `paths: uvc_camera_1:`
- Application: Stream Path = `/uvc_camera_1`

## Alternative Solutions

### Option 2: FFmpeg + Custom Script

For simple setups without multi-client support:

```bash
#!/bin/bash
DEVICE=${1:-/dev/video0}
STREAM_NAME=${2:-uvc_camera}
RTSP_PORT=${3:-8554}

ffmpeg -f v4l2 -i $DEVICE \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -b:v 2M -maxrate 2M -bufsize 2M \
  -f rtsp rtsp://0.0.0.0:$RTSP_PORT/$STREAM_NAME
```

**Note:** This approach has limitations (single client only). MediaMTX is strongly recommended for production use.

### Option 3: GStreamer with gst-rtsp-server

**Installation (Ubuntu/Debian):**
```bash
sudo apt-get install gstreamer1.0-rtsp gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly
```

**Example Launch Command:**
```bash
gst-rtsp-server \
  --gst-debug=2 \
  --rtsp-port=8554 \
  "( v4l2src device=/dev/video0 ! videoconvert ! x264enc tune=zerolatency ! rtph264pay name=pay0 pt=96 )"
```

## Additional Resources

- [MediaMTX GitHub Repository](https://github.com/bluenviron/mediamtx)
- [MediaMTX Documentation](https://github.com/bluenviron/mediamtx/tree/main/docs)
- [FFmpeg V4L2 Documentation](https://trac.ffmpeg.org/wiki/Capture/Webcam)
- [Video4Linux2 (V4L2) Documentation](https://www.kernel.org/doc/html/latest/userspace-api/media/v4l/v4l2.html)
