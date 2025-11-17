// API Configuration
// Frontend luôn gọi qua relative path /api/
// Nginx sẽ proxy sang API Gateway (nội bộ hoặc public tùy môi trường)
const API_BASE_URL = '/api';

// Log để debug
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:');
  console.log('  - API_BASE_URL:', API_BASE_URL);
  console.log('  - Mode:', import.meta.env.MODE);
}

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export default API_BASE_URL;
