import axios from 'axios';

// The full URL of the backend server
const API_URL = 'http://localhost:3001/api';

export interface Camera {
  id: number;
  name: string;
  host: string;
  port: number;
  xaddr: string | null;
  // We don't need user/pass on the frontend
}

export const getCameras = async (): Promise<Camera[]> => {
  const response = await axios.get<Camera[]>(`${API_URL}/cameras`);
  return response.data;
};

export type NewCamera = {
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
};

export const addCamera = async (camera: NewCamera): Promise<Camera> => {
    const response = await axios.post<Camera>(`${API_URL}/cameras`, camera);
    return response.data;
};

export interface DiscoveredDevice {
  address: string;
  port: number;
  hostname: string;
  name: string;
  manufacturer: string;
  xaddr: string | null;
}

export const discoverCameras = async (): Promise<DiscoveredDevice[]> => {
  // Subnet scan can take 2-3 minutes, so set a long timeout
  const response = await axios.get<{ devices: DiscoveredDevice[] }>(`${API_URL}/cameras/discover`, {
    timeout: 180000 // 3 minutes
  });
  return response.data.devices;
};

export const startStream = async (id: number): Promise<{ streamUrl: string }> => {
  const response = await axios.post<{ streamUrl: string }>(`${API_URL}/cameras/${id}/stream/start`);
  return response.data;
};

export const stopStream = async (id: number): Promise<{ success: boolean }> => {
    const response = await axios.post<{ success: boolean }>(`${API_URL}/cameras/${id}/stream/stop`);
    return response.data;
};

export const startRecording = async (id: number): Promise<{ success: boolean }> => {
  const response = await axios.post(`${API_URL}/cameras/${id}/recording/start`);
  return response.data;
};

export const stopRecording = async (id: number): Promise<{ success: boolean }> => {
  const response = await axios.post(`${API_URL}/cameras/${id}/recording/stop`);
  return response.data;
};

export interface Recording {
  id: number;
  filename: string;
  start_time: string;
  end_time: string;
  camera_name: string;
  thumbnail: string | null;
}

export const getRecordings = async (): Promise<Recording[]> => {
  const response = await axios.get<Recording[]>(`${API_URL}/recordings`);
  return response.data;
};

export const deleteCamera = async (id: number): Promise<void> => {
  await axios.delete(`${API_URL}/cameras/${id}`);
};

export interface CameraTimeInfo {
  cameraTime: any;
  serverTime: string;
}

export const getCameraTime = async (id: number): Promise<CameraTimeInfo> => {
  const response = await axios.get<CameraTimeInfo>(`${API_URL}/cameras/${id}/time`);
  return response.data;
};

export interface TimeSyncResult {
  success: boolean;
  beforeTime: any;
  serverTime: string;
  message: string;
}

export const syncCameraTime = async (id: number): Promise<TimeSyncResult> => {
  const response = await axios.post<TimeSyncResult>(`${API_URL}/cameras/${id}/sync-time`);
  return response.data;
};

export const deleteRecording = async (id: number): Promise<void> => {
  await axios.delete(`${API_URL}/recordings/${id}`);
};

export interface PTZCapabilities {
  supported: boolean;
  capabilities: {
    hasPanTilt: boolean;
    hasZoom: boolean;
  } | null;
}

export interface PTZMovement {
  x?: number;
  y?: number;
  zoom?: number;
  timeout?: number;
}

export interface PTZResult {
  success: boolean;
  message: string;
}

export const checkPTZCapabilities = async (id: number): Promise<PTZCapabilities> => {
  const response = await axios.get<PTZCapabilities>(`${API_URL}/cameras/${id}/ptz/capabilities`);
  return response.data;
};

export const movePTZ = async (id: number, movement: PTZMovement): Promise<PTZResult> => {
  const response = await axios.post<PTZResult>(`${API_URL}/cameras/${id}/ptz/move`, movement);
  return response.data;
};

export const stopPTZ = async (id: number): Promise<PTZResult> => {
  const response = await axios.post<PTZResult>(`${API_URL}/cameras/${id}/ptz/stop`, {
    panTilt: true,
    zoom: true
  });
  return response.data;
};