# 🧪 HƯỚNG DẪN CHẠY TEST - ORDER SERVICE PHASE 2

## 📋 YÊU CẦU

### 1. Cài đặt Dependencies
```bash
cd backend/services/order-service
npm install
```

### 2. Chuẩn bị Redis
Test cases này sử dụng **Redis thật**, không mock. Bạn cần có Redis đang chạy.

#### Option 1: Docker (Khuyến nghị)
```bash
# Start Redis với Docker
docker run -d -p 6379:6379 --name redis-test redis:latest

# Hoặc sử dụng docker-compose (nếu có trong project)
docker-compose up -d redis
```

#### Option 2: Redis Local
```bash
# macOS với Homebrew
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

### 3. Kiểm tra Redis
```bash
# Test kết nối Redis
redis-cli ping
# Kết quả: PONG
```

### 4. Environment Variables
Đảm bảo file `.env` có các biến sau:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
ORDER_SESSION_DURATION_MINUTES=15
```

---

## 🚀 CHẠY TESTS

### Chạy tất cả tests Phase 2
```bash
npm test -- tests/integration/Test_Pharse2
```

### Chạy từng file test riêng lẻ

#### 1. User Receives Payment URL (16 tests)
```bash
npm test -- tests/integration/Test_Pharse2/user-receives-payment-url.test.ts
```

#### 2. User Navigation Scenarios (26 tests)
```bash
npm test -- tests/integration/Test_Pharse2/user-navigation-scenarios.test.ts
```

#### 3. User Cancels on VNPay (29 tests)
```bash
npm test -- tests/integration/Test_Pharse2/user-cancels-on-vnpay.test.ts
```

#### 4. Session and Retry Logic (33 tests)
```bash
npm test -- tests/integration/Test_Pharse2/session-and-retry-logic.test.ts
```

### Chạy với options khác

#### Watch mode
```bash
npm test -- tests/integration/Test_Pharse2 --watch
```

#### Coverage
```bash
npm test -- tests/integration/Test_Pharse2 --coverage
```

#### Verbose output
```bash
npm test -- tests/integration/Test_Pharse2 --verbose
```

#### Chạy một test cụ thể
```bash
npm test -- tests/integration/Test_Pharse2/user-receives-payment-url.test.ts -t "TC1.1"
```

---

## 📊 KẾT QUẢ MẪU

Khi chạy thành công, bạn sẽ thấy:

```
PASS  tests/integration/Test_Pharse2/user-receives-payment-url.test.ts
  Phase 2: User Receives Payment URL
    Scenario 1: Order Service nhận payment.event từ Kafka
      ✓ TC1.1: Payment event chứa paymentUrl và paymentStatus = pending (5ms)
      ✓ TC1.2: Payment URL chứa đầy đủ tham số VNPay bắt buộc (3ms)
    Scenario 2: Redis Session vẫn active sau khi nhận payment URL
      ✓ TC2.1: Tạo Redis session thành công (45ms)
      ✓ TC2.2: Session có TTL đúng (35ms)
      ✓ TC2.3: Session data chứa đầy đủ thông tin (30ms)
      ✓ TC2.4: Session không bị xóa khi nhận payment URL (28ms)
    ...

Test Suites: 4 passed, 4 total
Tests:       104 passed, 104 total
Snapshots:   0 total
Time:        8.234 s
```

---

## 🔧 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi: "Redis connection failed"
**Nguyên nhân:** Redis chưa chạy hoặc không kết nối được

**Giải pháp:**
```bash
# Kiểm tra Redis có đang chạy không
redis-cli ping

# Nếu không chạy, start Redis
docker-compose up -d redis
# hoặc
brew services start redis
```

### Lỗi: "Cannot find module"
**Nguyên nhân:** Chưa cài dependencies

**Giải pháp:**
```bash
npm install
```

### Lỗi: "Timeout exceeded"
**Nguyên nhân:** Test chạy quá lâu

**Giải pháp:**
- Kiểm tra Redis có phản hồi nhanh không
- Tăng timeout trong jest.config.js:
```javascript
testTimeout: 15000 // từ 10000 lên 15000
```

### Lỗi: "Connection pool exhausted"
**Nguyên nhân:** Quá nhiều connections tới Redis

**Giải pháp:**
- Đảm bảo `redisClient.quit()` được gọi trong `afterAll()`
- Chạy từng file test thay vì chạy tất cả cùng lúc

---

## 🧹 DỌN DẸP SAU KHI TEST

### Xóa test data trong Redis
```bash
# Connect vào Redis CLI
redis-cli

# Xóa tất cả keys test
127.0.0.1:6379> KEYS order:session:test-*
127.0.0.1:6379> DEL order:session:test-order-user-receives-url
127.0.0.1:6379> DEL order:session:test-order-navigation
127.0.0.1:6379> DEL order:session:test-order-cancel-vnpay
127.0.0.1:6379> DEL order:session:test-order-retry-logic

# Hoặc flush toàn bộ database (Cẩn thận!)
127.0.0.1:6379> FLUSHDB
```

### Stop Redis (nếu dùng Docker)
```bash
docker stop redis-test
docker rm redis-test
```

---

## 📝 LƯU Ý QUAN TRỌNG

### ✅ Tests SỬ DỤNG:
- **Redis thật** - không mock
- **Hàm thật** - import từ source code
- **Integration testing** - test workflow thực tế

### ❌ Tests KHÔNG:
- Mock Redis operations
- Mock Prisma client trong tests này
- Mock các hàm quan trọng (createOrderSession, checkOrderSession, etc.)

### 🎯 Mục đích:
> Đảm bảo khi code thay đổi, test sẽ fail nếu logic sai

---

## 📚 TÀI LIỆU THAM KHẢO

- [TEST_CASES_SUMMARY.md](./Docs/TEST_CASES_SUMMARY.md) - Tổng hợp chi tiết 104 test cases
- [PHASE2_DOCUMENTATION.md](./Docs/PHASE2_DOCUMENTATION.md) - Tài liệu Phase 2
- [RETRY_PAYMENT_WORKFLOW.md](./Docs/RETRY_PAYMENT_WORKFLOW.md) - Workflow retry payment

---

## 🤝 CONTRIBUTION

Khi thêm test cases mới:
1. Tuân thủ naming convention: `TC{scenario}.{number}`
2. Viết test description rõ ràng bằng tiếng Việt
3. Import và sử dụng hàm thật, không mock
4. Update file TEST_CASES_SUMMARY.md

---

## 📞 SUPPORT

Nếu gặp vấn đề khi chạy tests, kiểm tra:
1. Redis có đang chạy không?
2. Dependencies đã được cài đầy đủ chưa?
3. Environment variables đã được set chưa?
4. Có conflict với tests khác đang chạy không?

---

**Created:** 31 Tháng 10, 2025  
**Version:** 1.0  
**Phase:** 2 - User Đến VNPay

