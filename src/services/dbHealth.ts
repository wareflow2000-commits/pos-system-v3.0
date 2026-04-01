import axios from 'axios';
import { API_BASE } from './apiService';

export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    return response.data?.connected === true;
  } catch (error) {
    console.error('Server database health check failed:', error);
    return false;
  }
};
