// API Configuration
// Sử dụng biến môi trường VITE_API_BASE_URL_PUBLIC cho frontend gọi API Gateway public
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export default API_BASE_URL;
