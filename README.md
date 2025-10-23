# ONVIF Web Application

This is a full-stack web application designed to manage and view ONVIF-compliant IP cameras. It consists of a Node.js backend and a React frontend.

## Features

*   **Camera Discovery**: Automatically discover ONVIF cameras on your local network using subnet scanning with unicast WS-Discovery probes.
*   **Camera Management**: Register, update, delete, and list ONVIF cameras.
*   **Live Video Streaming**: View a live HLS stream from any registered camera directly in the web browser.
*   **Video Recording & Playback**: Record live video streams as MP4 files on the server and play them back from a list within the application. Recordings from deleted cameras remain accessible.
*   **Connection Testing**: Automatically tests the ONVIF connection to a camera before saving its details.
*   **REST API**: Provides a simple API to interact with the camera data and streaming processes.

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
*   **Adding a Camera Manually**: Click the "Add Camera" button to open a dialog for the camera's details (Name, Host/IP, Port, Username, Password). The system tests the connection before adding the camera.
*   **Deleting a Camera**: Click the delete icon next to a camera in the main list. A confirmation prompt will appear before deletion.
*   **Viewing a Stream**: Click the "View Stream" button next to a camera in the list.
*   **Recording**: While viewing a stream, use the "Start Recording" and "Stop Recording" buttons to create MP4 recordings on the server.
*   **Playback**: A list of completed recordings is available at the bottom of the page. Click the "Play" button to watch a recording. Recordings from deleted cameras will be labeled accordingly and remain playable.

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

#### `GET /api/recordings`
Retrieves a list of all completed recordings, including camera name and file details. Recordings from deleted cameras are included.
