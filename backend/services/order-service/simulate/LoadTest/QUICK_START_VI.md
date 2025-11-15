# Hướng dẫn chạy K6 Load Test - Nhanh

## Trả lời câu hỏi của bạn

### 1️⃣ VUs thực hiện cùng lúc hay chia đều?
✅ **ĐÃ SỬA**: Script bây giờ dùng `stages` (ramp-up) thay vì 1000 VUs đột ngột:
- Phút 0-2: tăng từ 0 → 100 VUs
- Phút 2-7: tăng từ 100 → 500 VUs
- Phút 7-15: tăng từ 500 → 1000 VUs
- Phút 15-25: giữ ổn định 1000 VUs
- Phút 25-30: giảm dần về 0

👉 **Không còn spike đột ngột** - hệ thống có thời gian thích ứng

### 2️⃣ Dữ liệu có lưu vào DB thật không?
✅ **ĐÚNG**: Mọi request từ k6 → API Gateway → Backend → **Lưu vào PostgreSQL/Redis thật**

Hậu quả:
- 1000 VUs = 1000 user accounts trong `user-db`
- Mỗi VU tạo orders = hàng nghìn orders trong `order-db`
- Redis cart entries tích lũy

👉 **SAU KHI CHẠY TEST PHẢI CLEANUP DATABASE**

### 3️⃣ VUs phải register trước login?
✅ **ĐÚNG**: Mỗi VU phải:
1. Register account mới với email unique: `loaduser+vu1@example.com`, `loaduser+vu2@example.com`, ...
2. Login với account vừa tạo để lấy JWT token
3. Dùng token đó cho browse/cart/order

**Nếu register fail** → Script tự động thử login (phòng trường hợp account đã tồn tại)

**Nếu login cũng fail** → VU đó skip iteration

## Các bước chạy test

### Bước 1: Smoke Test (BẮT BUỘC)
Chạy thử nhỏ trước để kiểm tra:

```bash
k6 run --vus 10 --duration 1m Tests/LoadTest/k6-load-test.js
```

Quan sát output:
- ✅ Nếu thấy checks PASS và không nhiều lỗi → OK
- ❌ Nếu nhiều lỗi → xem phần Troubleshooting

### Bước 2: Small Test
Sau khi smoke test OK, chạy test lớn hơn:

```bash
k6 run --vus 50 --duration 5m Tests/LoadTest/k6-load-test.js
```

### Bước 3: Full Test (30 phút)
```bash
K6_BASE_URL=http://localhost:3000 \
K6_USER_EMAIL=loaduser@example.com \
K6_USER_PASS=password \
k6 run --out json=results.json Tests/LoadTest/k6-load-test.js
```

## Troubleshooting

### Lỗi: "Email hoặc mật khẩu không đúng"
**Nguyên nhân**: Register hoặc login fail

**Giải pháp**:
1. Kiểm tra endpoint `/api/auth/register` và `/api/auth/login` có hoạt động:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password","name":"Test"}'
```

2. Nếu email đã tồn tại (từ test trước), cleanup DB hoặc đổi `K6_USER_EMAIL`:
```bash
K6_USER_EMAIL=newload@example.com k6 run Tests/LoadTest/k6-load-test.js
```

### Lỗi: Browse menu trả rỗng
**Nguyên nhân**: Không có products trong `store-1`

**Giải pháp**: Seed products hoặc dùng fallback IDs:
```bash
FALLBACK_PRODUCT_ID=your-product-id-1 \
FALLBACK_PRODUCT_ID_2=your-product-id-2 \
FALLBACK_PRODUCT_ID_3=your-product-id-3 \
k6 run Tests/LoadTest/k6-load-test.js
```

### Lỗi: Add to cart fail hoặc Create order fail
**Nguyên nhân**: Product IDs không tồn tại trong DB

**Giải pháp**: Seed products vào DB trước khi test

## Cleanup sau test

⚠️ **QUAN TRỌNG**: Sau khi chạy test, bạn PHẢI cleanup DB

### Option 1: Xóa test users và orders
```bash
# Xóa test users
docker exec -it user-db psql -U postgres -d foodfast_user -c \
  "DELETE FROM users WHERE email LIKE 'loaduser+vu%@%';"

# Xóa test orders (adjust dựa vào schema)
docker exec -it order-db psql -U postgres -d foodfast_order -c \
  "DELETE FROM orders WHERE created_at > '2025-01-01';"
```

### Option 2: Reset toàn bộ DB (NGUY HIỂM)
```bash
docker-compose down -v  # Xóa volumes
docker-compose up -d    # Recreate fresh
```

## Monitor trong quá trình test

Mở Grafana (http://localhost:3001) và theo dõi:
- API Gateway request rate
- Service CPU/Memory
- Database connections
- Kafka consumer lag
- Response time P95

## Lưu ý quan trọng

1. **KHÔNG chạy 1000 VUs trên laptop** - cần server mạnh hoặc k6 cloud
2. **Luôn bắt đầu bằng smoke test** - đừng nhảy thẳng vào full test
3. **Chuẩn bị cleanup script** trước khi chạy
4. **Seed products** vào DB để tránh lỗi browse/cart/order
5. **Monitor Grafana** trong suốt quá trình test để phát hiện bottleneck

## Kết quả mong đợi

Sau khi test hoàn thành, k6 sẽ hiển thị summary:

```
✓ login status 200
✓ login contains token
✓ register status 200|201
✓ browse status 200
✓ add to cart status 200|201
✓ create order status 201|200

http_req_duration..........: avg=150ms min=50ms med=120ms max=2500ms p(95)=800ms
login_success..............: 98.5%
order_success..............: 95.2%
```

**Thành công nếu**:
- p(95) < 2000ms
- login_success > 95%
- order_success > 90%

