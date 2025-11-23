# Luồng xử lý Order với Socket Real-time

## Tổng quan

Hệ thống đã được cập nhật để hỗ trợ real-time communication thông qua Socket.IO service mới. Luồng xử lý order được cải thiện với các trạng thái rõ ràng hơn.

## Các trạng thái Order (OrderStatus)

1. **pending** - Chờ thanh toán
2. **confirmed** - Đã thanh toán thành công, chờ nhà hàng xử lý
3. **preparing** - Nhà hàng đang chuẩn bị
4. **readyForPickup** - Đã sẵn sàng để giao/lấy
5. **delivering** - Đang giao hàng
6. **completed** - Hoàn thành
7. **cancelled** - Đã hủy (thanh toán thất bại hoặc hết hạn)

## Luồng xử lý chi tiết

### 1. Tạo Order → Thanh toán

```
Customer → Order Service: Tạo order
Order Service → Database: Lưu order (status = pending)
Order Service → Kafka: Gửi event order.create
Payment Service: Xử lý thanh toán
Payment Service → Kafka: Gửi payment.event (status = success)
Order Service: Nhận event → Cập nhật order (status = confirmed)
```

### 2. Order Confirmed → Thông báo Restaurant Real-time

```
Order Service → Kafka: Gửi order.confirmed event
Socket Service: Nhận order.confirmed từ Kafka
Socket Service → WebSocket: Emit "order:confirmed" đến room "restaurant:{storeId}"
Restaurant Frontend: Nhận thông báo real-time, hiển thị đơn hàng mới
```

**Event payload:**
```json
{
  "eventType": "ORDER_CONFIRMED",
  "orderId": "uuid",
  "storeId": "store-uuid",
  "items": [...],
  "totalPrice": 100000,
  "deliveryAddress": "...",
  "contactPhone": "...",
  "note": "...",
  "confirmedAt": "2025-11-22T...",
  "estimatedPrepTime": 30
}
```

### 3. Restaurant chuyển sang Preparing (Tự động sau 30s)

```
Restaurant Service: Sau 30s tự động chuyển status = PREPARING
Restaurant Service → Database: Cập nhật RestaurantOrder (status = PREPARING)
Restaurant Service → Kafka: Gửi restaurant.order.status event
Socket Service: Nhận event từ Kafka
Socket Service → WebSocket: Emit "order:status:update" đến room "order:{orderId}"
Order Service: Nhận event từ Kafka → Cập nhật order (status = preparing)
Customer Frontend: Nhận cập nhật real-time
```

**Event payload:**
```json
{
  "eventType": "RESTAURANT_ORDER_STATUS_CHANGED",
  "orderId": "uuid",
  "storeId": "store-uuid",
  "restaurantStatus": "PREPARING",
  "timestamp": "2025-11-22T..."
}
```

### 4. Các trạng thái tiếp theo

Restaurant có thể chuyển đơn qua các trạng thái:
- **PREPARING** → Order Service cập nhật preparing
- **READY** → Order Service cập nhật readyForPickup
- **DELIVERING** → Order Service cập nhật delivering
- **COMPLETED** → Order Service cập nhật completed (xóa Redis session)

Mỗi lần chuyển trạng thái:
1. Restaurant Service publish event qua Kafka
2. Socket Service emit real-time đến customer
3. Order Service cập nhật database

## Socket.IO Integration

### Kết nối Socket từ Frontend

**Restaurant Merchant:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3011');

// Join restaurant room
socket.emit('join:restaurant', { storeId: 'your-store-id' });

// Lắng nghe đơn hàng mới
socket.on('order:confirmed', (data) => {
  console.log('New order received:', data);
  // Hiển thị notification, cập nhật UI
});
```

**Customer:**
```javascript
const socket = io('http://localhost:3011');

// Join order room để theo dõi đơn hàng
socket.emit('join:order', { orderId: 'your-order-id' });

// Lắng nghe cập nhật trạng thái
socket.on('order:status:update', (data) => {
  console.log('Order status updated:', data);
  // Cập nhật UI tracking order
});
```

## Các Service liên quan

### Socket Service (Mới)
- **Port:** 3011
- **Chức năng:** Xử lý real-time communication qua Socket.IO
- **Kafka Topics:** Subscribe to `order.confirmed`, `restaurant.order.status`

### Order Service
- **Kafka Topics:** 
  - Subscribe: `payment.event`, `restaurant.order.status`
  - Publish: `order.confirmed`

### Restaurant Service
- **Kafka Topics:**
  - Subscribe: `order.confirmed`
  - Publish: `restaurant.order.status`

## Thay đổi so với trước

### ❌ Cũ (Sai logic):
```
Payment success → Order status = "success" (Hoàn thành luôn)
```

### ✅ Mới (Đúng logic):
```
Payment success → Order status = "confirmed" (Chờ xử lý)
→ Restaurant preparing (30s) → Order status = "preparing"
→ Restaurant ready → Order status = "readyForPickup"
→ Delivering → Order status = "delivering"
→ Completed → Order status = "completed"
```

## Cấu hình môi trường

### Socket Service (.env)
```
PORT=3011
KAFKA_BROKERS=localhost:9092
KAFKA_SECURITY_PROTOCOL=PLAINTEXT
```

## API Testing

### Health Check
```bash
curl http://localhost:3011/health
```

### Metrics
```bash
curl http://localhost:3011/actuator/prometheus
```

## Monitoring

Socket service cung cấp các metrics:
- `socket_service_connections_total` - Tổng số kết nối
- `socket_service_emits_total` - Tổng số events emit
- `socket_service_http_requests_total` - HTTP requests

## Troubleshooting

### Socket không kết nối được
- Kiểm tra CORS settings
- Kiểm tra port 3011 có available không
- Kiểm tra Kafka connection

### Order status không cập nhật real-time
- Kiểm tra Kafka topics đã tạo chưa: `order.confirmed`, `restaurant.order.status`
- Kiểm tra consumer logs trong socket-service
- Kiểm tra frontend đã join đúng room chưa

