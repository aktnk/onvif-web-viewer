# ONVIF Web Application Backend

This is the backend server for a web application designed to manage, view, and record ONVIF-compliant IP cameras.

## Features (Current)

*   **Camera Management**: Register and list ONVIF cameras.
*   **Connection Testing**: Automatically tests the connection to a camera before saving its details.
*   **REST API**: Provides a simple API to interact with the camera data.

## Technology Stack

*   **Runtime**: [Node.js](https://nodejs.org/)
*   **Framework**: [Express.js](https://expressjs.com/)
*   **Database**: [SQLite3](https://www.sqlite.org/index.html)
*   **Query Builder**: [Knex.js](https://knexjs.org/)
*   **ONVIF Protocol**: [node-onvif](https://www.npmjs.com/package/node-onvif)

## Prerequisites

*   [Node.js](https://nodejs.org/) (v16 or later recommended)
*   [npm](https://www.npmjs.com/)

## Getting Started

1.  **Navigate to the backend directory**:
    ```sh
    cd backend
    ```

2.  **Install dependencies**:
    ```sh
    npm install
    ```
    This will install all required packages. The database file will be created automatically when the server runs for the first time.

## Running the Application

There are two ways to run the server:

*   **Development Mode**:
    This uses `nodemon` to automatically restart the server when file changes are detected.
    ```sh
    npm run dev
    ```

*   **Production Mode**:
    ```sh
    npm start
    ```

The server will be running at `http://localhost:3001`.

## API Endpoints

### Camera Management

#### `GET /api/cameras`

Retrieves a list of all registered cameras.

**Example `curl` request**:
```sh
curl http://localhost:3001/api/cameras
```

**Example response**:
```json
[
    {
        "id": 1,
        "name": "My First Camera",
        "host": "192.168.1.100",
        "port": 80,
        "user": "admin",
        "pass": "YourCameraPassword",
        "created_at": "2023-10-27 10:00:00",
        "updated_at": "2023-10-27 10:00:00"
    }
]
```

#### `POST /api/cameras`

Registers a new camera. It first tests the ONVIF connection and, if successful, saves the camera's information to the database.

**Request Body** (JSON):
*   `name` (string, required): A friendly name for the camera.
*   `host` (string, required): The IP address or hostname of the camera.
*   `port` (integer, optional, defaults to 80): The ONVIF port.
*   `user` (string, required): The username for the camera.
*   `pass` (string, required): The password for the camera.

**Example `curl` request**:
```sh
curl -X POST http://localhost:3001/api/cameras \
-H "Content-Type: application/json" \
-d '{
  "name": "Living Room Cam",
  "host": "192.168.1.101",
  "port": 80,
  "user": "admin",
  "pass": "password123"
}'
```

**Success Response** (`201 Created`):
Returns the newly created camera object.
```json
{
    "id": 2,
    "name": "Living Room Cam",
    "host": "192.168.1.101",
    "port": 80,
    "user": "admin",
    "pass": "password123",
    "created_at": "2023-10-27 10:05:00",
    "updated_at": "2023-10-27 10:05:00"
}
```

**Error Response** (`400 Bad Request`):
If the camera connection fails or fields are missing.
```json
{
    "error": "Camera connection failed. Please check host, port, and credentials. Details: Failed to connect: Wrong password"
}
```
