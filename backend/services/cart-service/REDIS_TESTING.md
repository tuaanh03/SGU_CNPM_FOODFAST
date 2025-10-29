# Hướng dẫn kiểm tra Redis khi test Cart Service

## Cách 1: Sử dụng Redis CLI trong Docker

### Bước 1: Kết nối vào Redis container
```bash
docker exec -it <redis-container-name> redis-cli
```

Hoặc nếu Redis có password:
```bash
docker exec -it <redis-container-name> redis-cli -a <password>
```

### Bước 2: Các lệnh Redis để kiểm tra Cart

#### 1. Xem tất cả keys đang có:
```redis
KEYS *
```

#### 2. Xem cart của một user cụ thể:
```redis
KEYS cart:*
```

#### 3. Xem chi tiết giỏ hàng (Redis Hash):
```redis
# Format: cart:{userId}:{restaurantId}
HGETALL cart:your-user-id:your-restaurant-id
```

#### 4. Xem metadata của cart:
```redis
HGETALL cart:meta:your-user-id:your-restaurant-id
```

#### 5. Xem thông tin sản phẩm:
```redis
HGETALL cart:product:your-product-id
```

#### 6. Xem TTL (thời gian sống) của key:
```redis
TTL cart:your-user-id:your-restaurant-id
```

#### 7. Xóa cart để test lại:
```redis
DEL cart:your-user-id:your-restaurant-id
DEL cart:meta:your-user-id:your-restaurant-id
```

#### 8. Xóa tất cả cart keys:
```redis
FLUSHDB
```

---

## Cách 2: Thêm API endpoint để kiểm tra Redis

Thêm endpoint `/debug/redis-keys` vào Cart Service để xem tất cả keys trong Redis.

---

## Cách 3: Sử dụng Redis GUI Tool

### RedisInsight (Official Redis GUI)
- Download: https://redis.io/insight/
- Connect đến: `localhost:6379`
- Xem trực quan tất cả keys và values

### Another Redis Desktop Manager
- Download: https://github.com/qishibo/AnotherRedisDesktopManager
- Free và dễ sử dụng

---

## Ví dụ Workflow Test

### 1. Gọi API thêm sản phẩm vào cart qua Postman:
```json
POST http://localhost:3000/api/cart/add
Authorization: Bearer <your-jwt-token>

{
  "restaurantId": "restaurant-uuid-123",
  "productId": "product-uuid-456",
  "quantity": 2,
  "productName": "Bánh mì",
  "productPrice": 25000,
  "productImage": "https://example.com/banh-mi.jpg"
}
```

### 2. Kiểm tra trong Redis CLI:
```redis
# Xem tất cả keys
KEYS *

# Output mong đợi:
# 1) "cart:user-id:restaurant-uuid-123"
# 2) "cart:meta:user-id:restaurant-uuid-123"
# 3) "cart:product:product-uuid-456"

# Xem chi tiết cart
HGETALL cart:user-id:restaurant-uuid-123
# Output:
# 1) "product-uuid-456"
# 2) "2"

# Xem metadata
HGETALL cart:meta:user-id:restaurant-uuid-123
# Output:
# 1) "createdAt"
# 2) "2025-10-12T10:30:00.000Z"
# 3) "updatedAt"
# 4) "2025-10-12T10:30:00.000Z"
# 5) "restaurantId"
# 6) "restaurant-uuid-123"

# Xem thông tin sản phẩm
HGETALL cart:product:product-uuid-456
# Output:
# 1) "name"
# 2) "Bánh mì"
# 3) "price"
# 4) "25000"
# 5) "image"
# 6) "https://example.com/banh-mi.jpg"
```

### 3. Gọi API lấy cart:
```
GET http://localhost:3000/api/cart/:restaurantId
Authorization: Bearer <your-jwt-token>
```

---

## Cấu trúc Redis Keys trong Cart Service

```
cart:{userId}:{restaurantId}           → Hash chứa {productId: quantity}
cart:meta:{userId}:{restaurantId}      → Hash chứa metadata (createdAt, updatedAt, restaurantId)
cart:product:{productId}               → Hash chứa thông tin sản phẩm (name, price, image)
```

---

## Troubleshooting

### Không thấy keys trong Redis?
1. Kiểm tra Redis container đang chạy: `docker ps`
2. Kiểm tra Cart Service đã connect Redis thành công (xem logs)
3. Kiểm tra JWT token có hợp lệ không
4. Kiểm tra userId có được extract đúng từ token không

### TTL quá ngắn?
- Mặc định TTL = 7 ngày (604800 giây)
- Có thể thay đổi trong file `.env`: `CART_TTL=604800`

