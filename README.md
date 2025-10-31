# ONVIF Web Application

This is a full-stack web application designed to manage and view ONVIF-compliant IP cameras. It consists of a Node.js backend and a React frontend.

![Main Interface](docs/images/main.png)

## Features

*   **Camera Discovery**: Automatically discover ONVIF cameras on your local network using subnet scanning with unicast WS-Discovery probes.
*   **Camera Management**: Register, update, delete, and list ONVIF cameras.
*   **Time Synchronization**: Synchronize camera time with the server's system time via ONVIF protocol. Cameras are automatically synced when registered, and can be manually synced anytime.
*   **Multi-Camera Live Streaming**: View up to 4 live HLS streams simultaneously in a 2×2 grid layout. Each camera stream operates independently with its own controls.
*   **PTZ Control**: Control Pan-Tilt-Zoom (PTZ) cameras directly from the web interface with intuitive directional controls and zoom slider. PTZ controls are automatically displayed for cameras that support the feature.
*   **Independent Recording**: Record video from multiple cameras simultaneously. Each camera has its own recording controls.
*   **Video Playback**: Play back recorded MP4 files from a list within the application. Recordings from deleted cameras remain accessible.
*   **Connection Testing**: Automatically tests the ONVIF connection to a camera before saving its details.
*   **Session Persistence**: Active camera streams are automatically restored after page reload.
*   **REST API**: Provides a simple API to interact with the camera data and streaming processes.

## Screenshots

### Camera Discovery

<table>
  <tr>
    <td width="50%"><img src="docs/images/discover_cameras.png" alt="Discover Cameras Button" width="100%" /></td>
    <td width="50%"><img src="docs/images/discovering_cameras.png" alt="Discovering Cameras" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Start camera discovery</em></td>
    <td align="center"><em>Scanning network for ONVIF cameras</em></td>
  </tr>
</table>

![Discovered Cameras](docs/images/discovered_cameras.png)
*List of discovered ONVIF cameras on the network with registration status*

### Live Streaming

![Live Streaming](docs/images/live_streaming.png)
*Multi-camera live streaming in 2×2 grid layout - view up to 4 cameras simultaneously with independent controls for each stream*

### PTZ Control

![PTZ Control](docs/images/ptz_control.png)
*Pan-Tilt-Zoom controls with directional buttons and zoom slider for PTZ-enabled cameras*

### Recording Playback

![Recording Playback](docs/images/replay_recording_file.png)
*Browse, play, and manage recorded video files with timestamp and camera information*

## Technology Stack

### Backend
*   **Runtime**: [Node.js](https://nodejs.org/)
*   **Framework**: [Express.js](https://expressjs.com/)
*   **Database**: [SQLite3](https://www.sqlite.org/index.html) with [Knex.js](https://knexjs.org/)
*   **ONVIF Protocol**: [onvif](https://www.npmjs.com/package/onvif)
*   **Video Processing**: [FFmpeg](https://ffmpeg.org/) for RTSP to HLS transcoding.
*   **CORS**: [cors](https://www.npmjs.com/package/cors) for handling cross-origin requests.

### Frontend
*   **Framework**: [React](https://reactjs.org/) with [Vite](https://vitejs.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **UI Library**: [Material-UI (MUI)](https://mui.com/)
*   **API Client**: [Axios](https://axios-http.com/)
*   **Video Playback**: [hls.js](https://github.com/video-dev/hls.js)

## Project Structure

The project is divided into two main parts:

-   `/backend`: The Node.js/Express server that handles all camera communication and video processing.
-   `/frontend`: The React single-page application that provides the user interface.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (v16 or later recommended)
*   [npm](https://www.npmjs.com/)
*   [FFmpeg](https://ffmpeg.org/download.html) must be installed on the machine running the backend server and available in the system's PATH.

### Installation & Running

You need to run both the backend and frontend servers in separate terminals for the application to work.

**1. Backend Server:**

```sh
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Run database migrations (first time setup)
npx knex migrate:latest

# Run the development server
npm run dev
```
The backend will be running at `http://localhost:3001`.

### Database Setup (Knex.js)

The backend uses [Knex.js](https://knexjs.org/) as a SQL query builder and migration tool with SQLite3.

**Database Configuration:**
- Database file: `backend/src/db/dev.sqlite3` (auto-created on first migration)
- Configuration file: `backend/knexfile.js`
- Migrations directory: `backend/src/db/migrations/`

**Available Migrations:**
- `20251015144534_create_cameras_table.js` - Creates the `cameras` table
- `20251016140916_add_xaddr_to_cameras.js` - Adds `xaddr` column for custom ONVIF URLs
- `20251018120100_create_recordings_table.js` - Creates the `recordings` table

**Common Knex Commands:**

```sh
cd backend

# Run all pending migrations
npx knex migrate:latest

# Rollback the last batch of migrations
npx knex migrate:rollback

# Check migration status
npx knex migrate:status

# Create a new migration file
npx knex migrate:make migration_name
```

**Database Schema:**

*cameras* table:
- `id` (primary key, auto-increment)
- `name` (text) - Camera display name
- `host` (text) - IP address or hostname
- `port` (integer) - ONVIF port (default: 80)
- `user` (text) - ONVIF username
- `pass` (text) - ONVIF password
- `xaddr` (text, nullable) - Custom ONVIF device service URL

*recordings* table:
- `id` (primary key, auto-increment)
- `camera_id` (integer, foreign key) - Reference to cameras table
- `filename` (text) - MP4 filename
- `start_time` (datetime) - Recording start timestamp
- `end_time` (datetime, nullable) - Recording end timestamp
- `is_finished` (boolean, default: false) - Recording completion status

**2. Frontend Server:**

```sh
# From the project root, navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```
The frontend will be running at `http://localhost:5173` and should open automatically in your browser.

## Usage

Once the application is running, you can manage your cameras through the web interface.

*   **Discovering Cameras**: Click the "Discover Cameras" button to automatically scan your local network. The scan will probe each IP address in your subnet and may take 2-3 minutes.
    *   Discovered cameras that are already registered will be marked as "Registered".
    *   You can add unregistered cameras by providing their credentials. The discovery window will remain open, allowing you to add multiple cameras without re-scanning.
*   **Adding a Camera Manually**: Click the "Add Camera" button to open a dialog for the camera's details (Name, Host/IP, Port, Username, Password). The system tests the connection before adding the camera. After successful registration, the camera's time is automatically synchronized with the server.
*   **Synchronizing Camera Time**: Click the sync icon (⟳) next to any camera in the list to manually synchronize its time with the server's system time. A notification will confirm success or display any errors.
*   **Deleting a Camera**: Click the red delete icon (🗑️) next to a camera in the main list. A confirmation prompt will appear before deletion.
*   **Viewing Multiple Streams**:
    *   Click the "View Stream" button next to a camera to add it to the grid view.
    *   You can view up to 4 cameras simultaneously in a 2×2 grid layout.
    *   Each camera stream has its own controls and operates independently.
    *   Click "Stop Stream" in the camera list or the "Close" button in the grid to remove a camera from view.
    *   If you try to add a 5th camera, you'll receive an alert indicating the maximum limit has been reached.
    *   Active streams are saved in session storage and will be automatically restored when you refresh the page.
*   **PTZ Control**: For cameras that support PTZ (Pan-Tilt-Zoom), a control panel will automatically appear below the video player for each camera.
    *   Use the directional arrow buttons (↑ ↓ ← →) to pan and tilt the camera. Press and hold to move; release to stop.
    *   Use the zoom slider or +/- buttons to zoom in and out. The camera will automatically stop zooming when you release the control.
    *   All PTZ controls support both mouse and touch input for mobile devices.
    *   Each camera's PTZ controls operate independently.
*   **Recording**: Each camera stream has its own "Start Recording" and "Stop Recording" buttons.
    *   You can record from multiple cameras simultaneously.
    *   The recording status (REC indicator) is displayed for each camera independently.
    *   Recordings are saved as MP4 files on the server.
*   **Playback & Management**: A list of completed recordings is available at the bottom of the page.
    *   Click the "Play" button to watch a recording. Recordings from deleted cameras will be labeled accordingly and remain playable.
    *   Click the red delete icon (🗑️) to permanently delete a recording. A confirmation prompt will appear before deletion. This will remove both the database record and the MP4 file from the server.

## API Reference

The backend provides the following REST API endpoints for programmatic access or debugging.

#### `GET /api/cameras`
Retrieves a list of all registered cameras.

#### `GET /api/cameras/discover`
Discovers ONVIF cameras on the local network using subnet scanning. This endpoint performs unicast WS-Discovery probes to each IP address in the subnet (default: 192.168.0.1-254). The scan typically takes 2-3 minutes to complete.

**Query Parameters** (optional):
- `subnet`: Subnet base address (e.g., `192.168.1`)
- `start`: Starting IP address (e.g., `1`)
- `end`: Ending IP address (e.g., `254`)

**Response**: Returns an array of discovered devices with their IP addresses, ports, device names, and ONVIF service URLs.

#### `POST /api/cameras`
Registers a new camera. It tests the ONVIF connection before saving. The request body can optionally include a full `xaddr` for cameras with non-standard ONVIF URLs.

#### `PUT /api/cameras/:id`
Updates an existing camera's information. Useful for adding or correcting details like the `xaddr`.
**Example Body**: `{ "xaddr": "http://192.168.1.100:8080/onvif/device_service" }`

#### `DELETE /api/cameras/:id`
Deletes a registered camera from the database.

#### `POST /api/cameras/:id/stream/start`
Starts the FFmpeg process to convert the camera's RTSP stream to HLS. Returns the relative URL of the HLS playlist (e.g., `/streams/1/index.m3u8`).

#### `POST /api/cameras/:id/stream/stop`
Stops the FFmpeg process for the specified camera.

#### `POST /api/cameras/:id/recording/start`
Starts a new recording for the specified camera. The video is saved as an MP4 file on the server.

#### `POST /api/cameras/:id/recording/stop`
Stops an in-progress recording and finalizes the MP4 file.

#### `GET /api/cameras/:id/time`
Retrieves the current date and time from the specified camera via ONVIF, along with the server's current time for comparison.

**Response Example**:
```json
{
  "cameraTime": { /* ONVIF date/time object */ },
  "serverTime": "2025-01-24T12:00:00.000Z"
}
```

#### `POST /api/cameras/:id/sync-time`
Synchronizes the specified camera's system time with the server's current time using ONVIF's `SetSystemDateAndTime` method. The time is set in UTC format.

**Response Example**:
```json
{
  "success": true,
  "beforeTime": { /* ONVIF date/time object before sync */ },
  "serverTime": "2025-01-24T12:00:00.000Z",
  "message": "Camera time synchronized successfully"
}
```

**Note**: The camera's time is synchronized to the server's system time. Ensure the server has accurate time (e.g., via NTP) for proper synchronization.

#### `GET /api/cameras/:id/ptz/capabilities`
Checks if the specified camera supports PTZ (Pan-Tilt-Zoom) functionality.

**Response Example**:
```json
{
  "supported": true,
  "capabilities": {
    "hasPanTilt": true,
    "hasZoom": true
  }
}
```

If PTZ is not supported, `supported` will be `false` and `capabilities` will be `null`.

#### `POST /api/cameras/:id/ptz/move`
Moves the camera using continuous PTZ movement. The camera will continue moving in the specified direction until a stop command is sent.

**Request Body**:
```json
{
  "x": 0.5,        // Pan speed: -1.0 (left) to 1.0 (right), 0 = no movement
  "y": 0.3,        // Tilt speed: -1.0 (down) to 1.0 (up), 0 = no movement
  "zoom": 0.2,     // Zoom speed: -1.0 (out) to 1.0 (in), 0 = no movement
  "timeout": 1000  // Optional: auto-stop after N milliseconds
}
```

**Response**:
```json
{
  "success": true,
  "message": "Camera movement started"
}
```

**Note**: Values represent movement speed/direction. Use 0.5 for moderate speed, 1.0 for maximum speed.

#### `POST /api/cameras/:id/ptz/stop`
Stops all ongoing PTZ movements (pan, tilt, and zoom).

**Request Body** (optional):
```json
{
  "panTilt": true,  // Stop pan/tilt movement (default: true)
  "zoom": true      // Stop zoom movement (default: true)
}
```

**Response**:
```json
{
  "success": true,
  "message": "Camera movement stopped"
}
```

#### `GET /api/recordings`
Retrieves a list of all completed recordings, including camera name and file details. Recordings from deleted cameras are included.

#### `DELETE /api/recordings/:id`
Deletes a recording by its ID. This removes both the database record and the associated MP4 file from the server's filesystem.

**Response**: Returns `204 No Content` on success.

**Error Handling**:
- If the recording ID is not found, returns `404 Not Found`
- If the file cannot be deleted but exists in the database, the database record is still removed to prevent orphaned records
