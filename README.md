# ONVIF Web Application

This is a full-stack web application designed to manage and view ONVIF-compliant IP cameras. It consists of a Node.js backend and a React frontend.

## Features

*   **Camera Management**: Register, update, and list ONVIF cameras.
*   **Live Video Streaming**: View a live HLS stream from any registered camera directly in the web browser.
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

## API Endpoints

The backend provides the following REST API endpoints.

#### `GET /api/cameras`
Retrieves a list of all registered cameras.

#### `POST /api/cameras`
Registers a new camera. It tests the ONVIF connection before saving. The request body can optionally include a full `xaddr` for cameras with non-standard ONVIF URLs.

#### `PUT /api/cameras/:id`
Updates an existing camera's information. Useful for adding or correcting details like the `xaddr`.
**Example Body**: `{ "xaddr": "http://192.168.1.100:8080/onvif/device_service" }`

#### `POST /api/cameras/:id/stream/start`
Starts the FFmpeg process to convert the camera's RTSP stream to HLS. Returns the relative URL of the HLS playlist (e.g., `/streams/1/index.m3u8`).

#### `POST /api/cameras/:id/stream/stop`
Stops the FFmpeg process for the specified camera.
