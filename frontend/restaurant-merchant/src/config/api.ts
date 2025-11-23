// API Configuration
// QUAN TRỌNG: Luôn gọi qua API Gateway (port 3000)
// Local dev: http://localhost:3000/api
// Vercel/Production: Set VITE_API_BASE_URL in environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Log để debug
console.log('🔧 API Configuration (Restaurant Merchant):');
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

