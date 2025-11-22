# Hướng dẫn Setup Socket Service và Cập nhật hệ thống

## 1. Cài đặt Socket Service

```bash
cd backend/services/socket-service

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## 2. Cập nhật Order Service

```bash
cd backend/services/order-service

# Regenerate Prisma Client (để nhận schema mới với confirmed, preparing,...)
npx prisma generate

# Optional: Nếu cần migrate database
npx prisma migrate dev --name add_order_status_flow

# Rebuild
npm run build
```

## 3. Cập nhật Restaurant Service

```bash
cd backend/services/restaurant-service

# Đã có sẵn code, chỉ cần rebuild
npm run build
```

## 4. Tạo Kafka Topics

Cần tạo các topics sau (nếu chưa có):

```bash
# Nếu dùng local Kafka
kafka-topics --create --topic order.confirmed --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
kafka-topics --create --topic restaurant.order.status --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1

# Nếu dùng Confluent Cloud, tạo topics trên UI hoặc CLI
```

## 5. Chạy các Services

Thứ tự khởi động:

```bash
# Terminal 1: Order Service
cd backend/services/order-service
npm start

# Terminal 2: Restaurant Service
cd backend/services/restaurant-service
npm start

# Terminal 3: Socket Service (MỚI)
cd backend/services/socket-service
npm start

# Terminal 4: Payment Service (nếu chưa chạy)
cd backend/services/payment-service
npm start
```

## 6. Kiểm tra Health Check

```bash
# Socket Service
curl http://localhost:3011/health

# Order Service
curl http://localhost:3001/health

# Restaurant Service
curl http://localhost:3005/health
```

## 7. Test luồng Order

### Bước 1: Tạo Order
```bash
curl -X POST http://localhost:3001/order/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "storeId": "store-456",
    "items": [
      {
        "productId": "prod-1",
        "productName": "Pizza",
        "productPrice": 100000,
        "quantity": 2
      }
    ],
    "totalPrice": 200000,
    "deliveryAddress": "123 Street",
    "contactPhone": "0901234567"
  }'
```

### Bước 2: Thanh toán thành công
- Payment service sẽ gửi event payment.success
- Order status → confirmed
- Socket emit "order:confirmed" đến restaurant

### Bước 3: Restaurant nhận và xử lý
- Sau 30s tự động chuyển sang PREPARING
- Socket emit "order:status:update" đến customer
- Order service cập nhật status → preparing

## 8. Frontend Integration

### Restaurant Dashboard

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3011');

// Join restaurant room khi login
socket.emit('join:restaurant', { storeId: myStoreId });

// Listen for new orders
socket.on('order:confirmed', (order) => {
  console.log('New order:', order);
  // Show notification
  // Update order list
});
```

### Customer Order Tracking

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3011');

// Join order room after creating order
socket.emit('join:order', { orderId: myOrderId });

// Track order status
socket.on('order:status:update', (data) => {
  console.log('Order status:', data.restaurantStatus);
  // Update UI: CONFIRMED → PREPARING → READY → DELIVERING → COMPLETED
});
```

## 9. Docker Compose (Optional)

Thêm socket-service vào docker-compose.yml:

```yaml
socket-service:
  build: ./backend/services/socket-service
  ports:
    - "3011:3011"
  environment:
    - PORT=3011
    - KAFKA_BROKERS=kafka:9092
    - KAFKA_SECURITY_PROTOCOL=PLAINTEXT
  depends_on:
    - kafka
  networks:
    - app-network
```

## 10. Monitoring

### Prometheus Metrics

Socket service expose metrics tại `/actuator/prometheus`:

- `socket_service_connections_total` - Số lượng connections
- `socket_service_emits_total{event_name}` - Số lượng events emit
- `socket_service_http_requests_total` - HTTP requests

### Logs

Tất cả services đều log JSON format cho Loki:

```bash
# Xem logs socket-service
docker logs -f socket-service

# Hoặc nếu chạy local
cd backend/services/socket-service
npm start | grep "Socket"
```

## 11. Troubleshooting

### Lỗi: Cannot find module
```bash
cd backend/services/socket-service
rm -rf node_modules
npm install
```

### Lỗi: Prisma Client
```bash
cd backend/services/order-service
npx prisma generate
```

### Lỗi: Kafka connection timeout
- Kiểm tra KAFKA_BROKERS trong .env
- Kiểm tra Kafka có đang chạy không: `docker ps | grep kafka`

### Socket không kết nối
- Kiểm tra CORS settings trong socket-service
- Kiểm tra frontend URL có match với CORS không
- Kiểm tra port 3011 có available không

## 12. Kiểm tra toàn bộ flow

```bash
# 1. Tạo order → pending
# 2. Payment success → confirmed
# 3. Check socket emit to restaurant
# 4. Đợi 30s → preparing
# 5. Check socket emit to customer
# 6. Check order-service database: status = preparing
```

## Tóm tắt thay đổi

### ✅ Đã thêm
- **Socket Service**: Real-time communication
- **Order Status Flow**: pending → confirmed → preparing → readyForPickup → delivering → completed
- **Kafka Topics**: `order.confirmed`, `restaurant.order.status`

### ✅ Đã sửa
- Order-service: Payment success → status = "confirmed" (không phải "success")
- Restaurant-service: Publish event khi chuyển status
- Real-time notifications cho restaurant và customer

### 📋 Cần làm tiếp (Tùy chọn)
- Thêm authentication cho Socket.IO
- Thêm UI trong frontend để hiển thị notifications
- Thêm retry logic cho Kafka producer
- Thêm logging chi tiết hơn
- Setup monitoring dashboard cho Socket service

