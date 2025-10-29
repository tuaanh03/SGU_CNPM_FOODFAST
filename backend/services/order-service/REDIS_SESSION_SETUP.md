# Hướng dẫn Setup Redis Session Management cho Order Service

## Tổng quan thay đổi

Đã thực hiện các thay đổi sau:

1. ✅ **Xóa model OrderSession** - Không lưu session vào database nữa
2. ✅ **Xóa enum OrderSessionStatus** - Không cần thiết nữa
3. ✅ **Thêm `expirationTime` vào model Order** - Lưu thời điểm hết hạn thanh toán
4. ✅ **Đơn giản hóa OrderStatus enum** - Chỉ còn: `pending`, `success`, `cancelled`
5. ✅ **Cài đặt ioredis** - Client để kết nối Redis
6. ✅ **Tạo Redis Session Manager** - Quản lý session với TTL tự động
7. ✅ **Cấu hình Redis Keyspace Notifications** - Tự động xử lý khi session hết hạn
8. ✅ **Cập nhật controllers và Kafka consumers** - Sử dụng Redis thay vì database

## OrderStatus Workflow

- `pending` → Đơn hàng mới tạo, chờ thanh toán
- `success` → Thanh toán thành công
- `cancelled` → Thanh toán thất bại, bị hủy, hoặc hết hạn

## Các bước thực hiện tiếp theo

### Bước 1: Chạy Prisma Generate và Migration

```bash
cd backend/services/order-service

# Generate Prisma Client mới
npx prisma generate

# Tạo migration mới (tên migration đã cập nhật)
npx prisma migrate dev --name remove_order_session_simplify_status
```

### Bước 2: Build lại TypeScript

```bash
npm run build
# hoặc
pnpm build
```

### Bước 3: Khởi động lại services với Docker Compose

```bash
# Từ thư mục root của project
docker-compose down
docker-compose up --build
```

## Cách hoạt động của Redis Session Management

### 1. Tạo Order và Session

Khi tạo order mới:
- Order được lưu vào PostgreSQL với `expirationTime` = hiện tại + 15 phút
- Session được lưu vào Redis với TTL = 15 phút
- Redis key format: `order:session:{orderId}`

### 2. Tự động hủy Order hết hạn

Khi Redis key hết hạn (sau 15 phút):
- Redis gửi expired event
- Service lắng nghe event và cập nhật Order status → `cancelled`
- Không cần cron job hay background worker

### 3. Xóa Session khi thanh toán

Khi payment thành công hoặc thất bại:
- Service nhận event từ Payment Service qua Kafka
- Cập nhật Order status → `success` hoặc `cancelled`
- Xóa Redis session để tiết kiệm bộ nhớ

## Cấu hình Redis

### Biến môi trường (.env)

```env
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
ORDER_SESSION_DURATION_MINUTES=15
```

### Docker Compose

Redis đã được cấu hình với:
```yaml
command: redis-server --appendonly yes --notify-keyspace-events Ex
```

- `--notify-keyspace-events Ex`: Bật expired events
- `E`: Keyevent events
- `x`: Expired events

## API Response Changes

### Trước (với OrderSession trong DB)

```json
{
  "orderId": "uuid",
  "session": {
    "sessionId": "uuid",
    "expiresAt": "2025-10-29T...",
    "durationMinutes": 15,
    "status": "active"
  }
}
```

### Sau (với Redis Session)

```json
{
  "orderId": "uuid",
  "expirationTime": "2025-10-29T...",
  "session": {
    "expiresAt": "2025-10-29T...",
    "durationMinutes": 15
  }
}
```

## Kiểm tra Redis hoạt động

### 1. Kết nối vào Redis container

```bash
docker exec -it redis redis-cli
```

### 2. Kiểm tra config

```redis
CONFIG GET notify-keyspace-events
# Kết quả: 1) "notify-keyspace-events" 2) "Ex"
```

### 3. Xem các keys đang có

```redis
KEYS order:session:*
```

### 4. Xem TTL của một order

```redis
TTL order:session:{orderId}
# Kết quả: số giây còn lại, hoặc -2 (không tồn tại), -1 (không có TTL)
```

### 5. Monitor expired events

```bash
# Terminal 1: Subscribe vào expired events
docker exec -it redis redis-cli
SUBSCRIBE __keyevent@0__:expired

# Terminal 2: Tạo test key với TTL ngắn
docker exec -it redis redis-cli
SETEX test:key 5 "test value"

# Sau 5 giây, Terminal 1 sẽ nhận được event
```

## Ưu điểm của cách tiếp cận này

1. ✅ **Giảm tải database** - Session được lưu trong RAM thay vì disk
2. ✅ **Tự động cleanup** - Redis TTL xóa key khi hết hạn
3. ✅ **Không cần cron job** - Redis expired events xử lý tự động
4. ✅ **Performance cao** - Redis in-memory, truy xuất nhanh
5. ✅ **Scalable** - Có thể cluster Redis khi cần
6. ✅ **Simple code** - Logic đơn giản hơn so với polling database

## Monitoring và Logging

Service sẽ log các sự kiện sau:

```
✅ Redis connected successfully
✅ Created Redis session for order {orderId}, expires in 15 minutes
🎧 Redis expiration listener initialized
✅ Subscribed to Redis expired events on channel: __keyevent@0__:expired
⏰ Order session expired: {orderId}
✅ Updated order {orderId} status to CANCELLED (expired)
🗑️  Deleted Redis session for order {orderId}
```

## Troubleshooting

### Lỗi: Redis connection refused

```bash
# Kiểm tra Redis đang chạy
docker ps | grep redis

# Kiểm tra logs
docker logs redis
```

### Lỗi: Không nhận được expired events

```bash
# Kiểm tra config Redis
docker exec -it redis redis-cli CONFIG GET notify-keyspace-events

# Nếu không đúng, set lại
docker exec -it redis redis-cli CONFIG SET notify-keyspace-events Ex
```

### Lỗi: Prisma type errors

```bash
# Chạy lại generate
cd backend/services/order-service
npx prisma generate
npm run build
```

## Testing

### Test tạo order và session

```bash
curl -X POST http://localhost:3000/order \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [...],
    "deliveryAddress": "123 Test St",
    "contactPhone": "0123456789"
  }'
```

### Test session expiration (development)

Để test nhanh, giảm `ORDER_SESSION_DURATION_MINUTES` xuống 1 phút trong .env:

```env
ORDER_SESSION_DURATION_MINUTES=1
```

Sau đó tạo order và đợi 1 phút, kiểm tra status sẽ tự động chuyển sang `expired`.

## Notes

- Session duration mặc định: **15 phút**
- Redis DB: **0** (có thể thay đổi trong .env)
- Khi payment service xử lý thanh toán, Redis session sẽ được xóa ngay lập tức
- Order status workflow: `pending` → `success`/`cancelled`
- Khi hết hạn: Order tự động chuyển sang `cancelled`

