// Socket.IO Configuration
// Local dev: http://localhost:3011
// Docker: http://socket-service:3011 (internal) hoặc http://localhost:3011
// Deploy: Dùng VITE_SOCKET_URL từ env

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3011';

console.log('🔌 Socket Configuration (Restaurant Merchant):');
console.log('  - SOCKET_URL:', SOCKET_URL);
console.log('  - Mode:', import.meta.env.MODE);

export const SOCKET_CONFIG = {
  url: SOCKET_URL,
  options: {
    autoConnect: false, // Chỉ connect khi cần
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'],
  },
};

export default SOCKET_URL;

