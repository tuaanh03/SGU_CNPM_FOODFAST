// API Configuration
// Vercel: dùng public URL của API Gateway
// Railway/Docker: dùng relative path /api (nginx proxy)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Log để debug
console.log('🔧 API Configuration:');
console.log('  - API_BASE_URL:', API_BASE_URL);
console.log('  - Mode:', import.meta.env.MODE);

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export default API_BASE_URL;
