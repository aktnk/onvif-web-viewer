import axios from 'axios';

// The base URL will be proxied by the Vite dev server to the backend
const API_URL = '/api';

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

export const startStream = async (id: number): Promise<{ streamUrl: string }> => {
  const response = await axios.post<{ streamUrl: string }>(`${API_URL}/cameras/${id}/stream/start`);
  return response.data;
};

export const stopStream = async (id: number): Promise<{ success: boolean }> => {
    const response = await axios.post<{ success: boolean }>(`${API_URL}/cameras/${id}/stream/stop`);
    return response.data;
};
