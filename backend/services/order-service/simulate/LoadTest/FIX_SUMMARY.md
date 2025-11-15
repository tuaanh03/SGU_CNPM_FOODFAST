# ✅ Đã sửa xong! Hướng dẫn chạy K6 Load Test

## 🎯 Vấn đề đã được giải quyết

### 1. ❌ Lỗi ban đầu: "couldn't be found on local disk"
**Nguyên nhân**: Chạy k6 từ sai thư mục

**Đã sửa**: Phải chạy từ thư mục gốc project:
```bash
cd /Users/anhngo/Downloads/Developer/NAM4/CNPM/Project/payment-processing-microservices-main
k6 run backend/services/order-service/simulate/LoadTest/k6-load-test.js
```

### 2. ❌ Lỗi tiếp: Endpoints sai (100% fail)
**Nguyên nhân**: Script dùng `/api/auth/register` và `/api/auth/login` nhưng API thực tế là:
- `/api/auth/customer/register`
- `/api/auth/customer/login`

**Đã sửa**: Cập nhật tất cả endpoints trong script

### 3. ⚠️ Vấn đề mới phát hiện: Rate Limiting
**Nguyên nhân**: API Gateway có rate limit:
- Auth endpoints: **50 requests / 15 phút**
- Order endpoints: **10 requests / phút**

**Hậu quả**: Load test với 10+ VUs sẽ bị chặn 429 (Too Many Requests)

---

## 🚀 Cách chạy test (sau khi sửa)

### Option 1: Tắt Rate Limit (Khuyến nghị cho load test)

Sửa file `backend/services/api-gateway/src/utils/limiters.ts`:

```typescript
// Auth limiter: DISABLE for load test
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,  // Tăng lên rất cao
  message: { error: "Too many requests to /auth, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Order limiter: DISABLE for load test  
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100000,  // Tăng lên rất cao
  message: { error: "Too many requests to /order, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
```

Sau đó **rebuild và restart api-gateway**:
```bash
docker-compose build api-gateway
docker-compose up -d api-gateway
```

### Option 2: Giảm VUs xuống (Tạm thời)

Chạy test với ít VUs hơn để không vượt rate limit:

```bash
# Smoke test - OK với rate limit hiện tại
k6 run --vus 5 --duration 1m backend/services/order-service/simulate/LoadTest/k6-load-test.js

# Small test  
k6 run --vus 20 --duration 5m backend/services/order-service/simulate/LoadTest/k6-load-test.js
```

### Option 3: Dùng stages chậm hơn

Sửa script để ramp-up chậm hơn (tránh spike):

```javascript
export let options = {
  stages: [
    { duration: '5m', target: 50 },    // rất chậm
    { duration: '10m', target: 100 },
    { duration: '10m', target: 200 },
    { duration: '5m', target: 0 }
  ],
  // ...
};
```

---

## ✅ Lệnh chạy test đúng (sau khi tắt rate limit)

### Smoke Test (5 VUs, 1 phút)
```bash
cd /Users/anhngo/Downloads/Developer/NAM4/CNPM/Project/payment-processing-microservices-main
k6 run --vus 5 --duration 1m backend/services/order-service/simulate/LoadTest/k6-load-test.js
```

### Small Test (50 VUs, 5 phút)
```bash
k6 run --vus 50 --duration 5m backend/services/order-service/simulate/LoadTest/k6-load-test.js
```

### Full Test (theo stages trong script - 30 phút)
```bash
k6 run backend/services/order-service/simulate/LoadTest/k6-load-test.js
```

### Debug Test (xem responses chi tiết)
```bash
k6 run --vus 1 --iterations 1 backend/services/order-service/simulate/LoadTest/debug-test.js
```

---

## 📊 Kết quả mong đợi (sau khi sửa)

```
✓ register status 200|201    100%
✓ login status 200          100%
✓ login contains token      100%
✓ browse status 200         varies (phụ thuộc vào có products không)
✓ add to cart status 200|201 varies
✓ create order status 201|200 varies

http_req_duration........: avg=XXXms p(95)<2000ms
login_success............: >95%
order_success............: >90%
```

---

## 🐛 Troubleshooting

### Vẫn thấy 429 Rate Limit?
- Đảm bảo đã rebuild api-gateway sau khi sửa limiters.ts
- Restart api-gateway container: `docker restart api-gateway`
- Xóa cache nếu có

### Browse menu trả rỗng?
- Seed products vào DB trước
- Hoặc set FALLBACK_PRODUCT_ID env vars

### Create order fail?
- Kiểm tra products tồn tại trong DB
- Xem logs backend để biết lỗi cụ thể

---

## 🎯 Tóm tắt

✅ **File location**: `backend/services/order-service/simulate/LoadTest/k6-load-test.js`

✅ **Phải chạy từ thư mục gốc project**

✅ **Endpoints đã sửa đúng**: `/api/auth/customer/register` và `/api/auth/customer/login`

⚠️ **QUAN TRỌNG**: Phải tắt rate limit trước khi chạy load test với 100+ VUs

✅ **Register trả luôn token** - không cần login riêng sau register (nhưng script vẫn có fallback)

