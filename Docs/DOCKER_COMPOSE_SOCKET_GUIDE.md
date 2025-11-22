# Hướng dẫn chạy Socket Service với Docker Compose

## 🚀 Quick Start

### 1. Build và chạy tất cả services

```bash
# Từ thư mục root của project
docker-compose up -d --build
```

### 2. Chỉ build và chạy socket-service

```bash
# Build socket-service
docker-compose build socket-service

# Chạy socket-service
docker-compose up -d socket-service
```

### 3. Kiểm tra socket-service

```bash
# Check logs
docker logs -f socket-service

# Check health
curl http://localhost:3011/health

# Expected response:
# {
#   "success": true,
#   "message": "Socket service is healthy",
#   "service": "socket-service",
#   "version": "1.0.0",
#   "timestamp": "2025-11-22T...",
#   "connections": 0
# }
```

## 📦 Services được chạy

Sau khi chạy `docker-compose up -d`, các services sau sẽ được khởi động:

- **socket-service**: Port 3011 (MỚI)
- **api-gateway**: Port 3000
- **user-service**: Port 1000
- **order-service**: Port 2000
- **restaurant-service**: Port 3005
- **product-service**: Port 3004
- **payment-service**: Port 4000
- **notification-service**: Port 5001
- **cart-service**: Port 3006
- **location-service**: Port 3007
- **kafka**: Port 9092
- **redis**: Port 6379
- **prometheus**: Port 9090
- **grafana**: Port 3001
- **loki**: Port 3100

## 🔍 Kiểm tra Socket Service

### Health Check
```bash
curl http://localhost:3011/health
```

### Metrics (Prometheus)
```bash
curl http://localhost:3011/actuator/prometheus
```

### Kiểm tra logs
```bash
# Xem logs real-time
docker logs -f socket-service

# Xem 100 dòng logs cuối
docker logs --tail 100 socket-service
```

## 🧪 Test Socket.IO Connection

### Từ Browser Console

```javascript
// Load Socket.IO client
const script = document.createElement('script');
script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
document.head.appendChild(script);

// Sau khi load xong, connect
setTimeout(() => {
  const socket = io('http://localhost:3011');
  
  socket.on('connect', () => {
    console.log('✅ Connected to socket-service:', socket.id);
  });
  
  // Test join restaurant room
  socket.emit('join:restaurant', { storeId: 'test-store-123' });
  
  socket.on('joined:restaurant', (data) => {
    console.log('✅ Joined restaurant room:', data);
  });
  
  // Listen for order events
  socket.on('order:confirmed', (order) => {
    console.log('🆕 New order:', order);
  });
}, 1000);
```

### Từ Node.js

```bash
# Install socket.io-client
npm install socket.io-client

# Tạo file test.js
cat > test-socket.js << 'EOF'
const io = require('socket.io-client');

const socket = io('http://localhost:3011');

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  // Join restaurant room
  socket.emit('join:restaurant', { storeId: 'store-123' });
});

socket.on('joined:restaurant', (data) => {
  console.log('✅ Joined room:', data);
});

socket.on('order:confirmed', (order) => {
  console.log('🆕 New order received:', order);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});
EOF

# Run test
node test-socket.js
```

## 🔄 Restart Services

```bash
# Restart socket-service
docker-compose restart socket-service

# Restart tất cả services
docker-compose restart

# Stop và start lại
docker-compose down
docker-compose up -d
```

## 🐛 Troubleshooting

### Socket service không start được

```bash
# Check logs
docker logs socket-service

# Rebuild
docker-compose build socket-service --no-cache
docker-compose up -d socket-service
```

### Kafka connection failed

```bash
# Check Kafka is running
docker ps | grep kafka

# Check Kafka logs
docker logs kafka

# Restart Kafka và socket-service
docker-compose restart kafka
docker-compose restart socket-service
```

### Port 3011 đã được sử dụng

```bash
# Check process using port 3011
lsof -i :3011

# Kill process (Mac/Linux)
kill -9 <PID>

# Hoặc thay đổi port trong docker-compose.yml
ports:
  - "3012:3011"  # Map port 3012 thay vì 3011
```

## 📊 Monitoring

### Xem tất cả logs của services

```bash
# All services
docker-compose logs -f

# Chỉ socket-service và order-service
docker-compose logs -f socket-service order-service

# Xem logs từ 5 phút trước
docker-compose logs --since 5m socket-service
```

### Check metrics trong Prometheus

1. Mở http://localhost:9090
2. Query: `socket_service_connections_total`
3. Query: `socket_service_emits_total`

### Check trong Grafana

1. Mở http://localhost:3001 (admin/admin)
2. Import dashboard cho socket-service
3. Xem real-time metrics

## 🎯 Test Full Flow

### 1. Tạo order qua API

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "storeId": "store-123",
    "items": [
      {
        "productId": "prod-1",
        "quantity": 2
      }
    ],
    "totalPrice": 200000
  }'
```

### 2. Kiểm tra socket-service logs

```bash
docker logs -f socket-service

# Bạn sẽ thấy:
# 📥 Socket service received event from topic order.confirmed
# ✅ Emitted order:confirmed to restaurant:store-123
```

### 3. Kiểm tra order-service logs

```bash
docker logs -f order-service

# Sau 30s, sẽ thấy:
# 📥 Received restaurant status update for order xxx: PREPARING
# ✅ Order xxx status updated to: preparing
```

## 🔐 Production Setup

Khi deploy production, cần thay đổi:

### 1. Cập nhật CORS trong socket-service

```typescript
// src/server.ts
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      "https://your-production-domain.com",
      "https://restaurant.your-domain.com"
    ],
    credentials: true,
  },
});
```

### 2. Sử dụng environment variables

```yaml
# docker-compose.yml
socket-service:
  environment:
    - NODE_ENV=production
    - CORS_ORIGIN=https://your-domain.com
```

### 3. Enable authentication

Thêm middleware xác thực Socket.IO connection.

## 📚 Tài liệu tham khảo

- [Socket Service Setup Guide](./SOCKET_SERVICE_SETUP_GUIDE.md)
- [Real-time Flow Documentation](./SOCKET_REALTIME_FLOW.md)
- [Architecture Diagram](./ARCHITECTURE_REALTIME_DIAGRAM.md)

## 🎉 Hoàn tất!

Giờ bạn có thể:
- ✅ Chạy toàn bộ hệ thống với Docker Compose
- ✅ Socket service tự động connect với Kafka
- ✅ Real-time notifications cho restaurant và customer
- ✅ Monitor qua Prometheus và Grafana

