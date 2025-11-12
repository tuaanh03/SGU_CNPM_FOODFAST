// API Configuration
// Khi chạy trong Docker, Nginx sẽ proxy /api/* tới api-gateway
// Khi chạy local dev, sẽ dùng localhost:3000

// @ts-ignore - Vite env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Helper function để tạo full URL
export const getApiUrl = (endpoint: string): string => {
  // Nếu endpoint đã bắt đầu với /api, không thêm nữa
  if (endpoint.startsWith('/api')) {
    return `${API_BASE_URL.replace('/api', '')}${endpoint}`;
  }
  // Nếu không, thêm /api vào
  return `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`;
};

export default API_BASE_URL;

