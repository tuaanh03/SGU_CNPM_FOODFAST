// API Configuration
// Khi chạy trong Docker/Production: VITE_API_BASE_URL = '/api' (được set trong Dockerfile)
// Nginx sẽ proxy /api/* tới api-gateway
// Khi chạy local dev: VITE_API_BASE_URL = 'http://localhost:3000/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Log để debug (chỉ trong development)
if (import.meta.env.DEV) {
  console.log('🔧 API_BASE_URL:', API_BASE_URL);
  console.log('🔧 VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
}

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};


export default API_BASE_URL;

