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
}

export const getRecordings = async (): Promise<Recording[]> => {
  const response = await axios.get<Recording[]>(`${API_URL}/recordings`);
  return response.data;
};