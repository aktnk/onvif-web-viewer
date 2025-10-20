# ONVIF Web Application

This is a full-stack web application designed to manage and view ONVIF-compliant IP cameras. It consists of a Node.js backend and a React frontend.

## Features

*   **Camera Discovery**: Automatically discover ONVIF cameras on your local network using subnet scanning with unicast WS-Discovery probes.
*   **Camera Management**: Register, update, and list ONVIF cameras.
*   **Live Video Streaming**: View a live HLS stream from any registered camera directly in the web browser.
*   **Video Recording & Playback**: Record live video streams as MP4 files on the server and play them back from a list within the application.
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

# Run the development server
npm run dev
```
The backend will be running at `http://localhost:3001`.

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

*   **Discovering Cameras**: Click the "Discover Cameras" button to automatically scan your local network (subnet) for ONVIF-compliant cameras. The scan will probe each IP address in your subnet (typically 192.168.0.1-254) and may take 2-3 minutes to complete. Once discovered, you can add cameras to your list by providing their credentials.
    *   **Note**: This feature uses unicast WS-Discovery probes, which can detect cameras that don't respond to standard multicast discovery.
*   **Adding a Camera Manually**: Click the "Add Camera" button. A dialog will appear asking for the camera's details, including Name, Host/IP Address, ONVIF Port, Username, and Password. The system will test the connection before adding the camera to the list.
*   **Viewing a Stream**: Click the "View Stream" button next to a camera in the list.
*   **Recording**: While viewing a stream, use the "Start Recording" and "Stop Recording" buttons to create MP4 recordings on the server.
*   **Playback**: A list of completed recordings is available at the bottom of the page. Click the "Play" button to watch a recording in a modal window.

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

#### `POST /api/cameras/:id/stream/start`
Starts the FFmpeg process to convert the camera's RTSP stream to HLS. Returns the relative URL of the HLS playlist (e.g., `/streams/1/index.m3u8`).

#### `POST /api/cameras/:id/stream/stop`
Stops the FFmpeg process for the specified camera.

#### `POST /api/cameras/:id/recording/start`
Starts a new recording for the specified camera. The video is saved as an MP4 file on the server.

#### `POST /api/cameras/:id/recording/stop`
Stops an in-progress recording and finalizes the MP4 file.

#### `GET /api/recordings`
Retrieves a list of all completed recordings, including camera name and file details.
