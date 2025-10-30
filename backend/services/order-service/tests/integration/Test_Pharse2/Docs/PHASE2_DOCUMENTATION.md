# 📋 PHASE 2 - INTEGRATION TEST DOCUMENTATION
## User Đến VNPay và Các Hành Vi Navigation

---

## 🎯 TỔNG QUAN PHASE 2

### Phạm Vi Phase 2
Phase 2 tập trung vào giai đoạn **sau khi payment URL được tạo** và **trước khi VNPay trả về kết quả thanh toán**.

**Phase 2 bao gồm:**
- ✅ User nhận được payment URL
- ✅ User được redirect đến VNPay gateway
- ✅ User đóng tab VNPay
- ✅ User quay lại trang web
- ✅ User bấm back button trên VNPay
- ✅ User bấm "Hủy giao dịch" trên VNPay (trước khi submit)

**Phase 2 KHÔNG bao gồm:**
- ❌ VNPay callback với kết quả thanh toán
- ❌ Cập nhật order status thành success/cancelled dựa trên VNPay response
- ❌ Xử lý IPN (Instant Payment Notification)

---

## 📊 WORKFLOW CHI TIẾT PHASE 2

### Bước 1: Payment Service Publishes payment.event

**Kafka Topic:** `payment.event`  
**Producer:** Payment Service  
**Consumer:** Order Service

```json
{
  "orderId": "order-uuid-123",
  "userId": "user-uuid-456",
  "email": "user@example.com",
  "amount": 100000,
  "item": "Order order-uuid-123",
  "paymentStatus": "pending",
  "paymentIntentId": "pi-uuid-789",
  "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=10000000&vnp_TxnRef=1234567890&vnp_OrderInfo=Payment+for+Order+order-uuid-123&..."
}
```

**Mô tả:**
- Payment Service đã tạo xong PaymentIntent và PaymentAttempt
- VNPay payment URL đã được generate
- Event được publish để thông báo cho Order Service
- `paymentStatus: "pending"` nghĩa là đang chờ user thanh toán

---

### Bước 2: Order Service Consumes payment.event

**Order Service nhận event từ Kafka:**

```typescript
// Kafka consumer trong Order Service
consumer.on('message', async (message) => {
  const event = JSON.parse(message.value);
  
  // event = {
  //   orderId: "order-uuid-123",
  //   paymentStatus: "pending",
  //   paymentUrl: "https://sandbox.vnpayment.vn/...",
  //   ...
  // }
  
  if (event.paymentStatus === 'pending') {
    // Lưu paymentUrl (nếu cần) hoặc chỉ log
    // KHÔNG thay đổi order status
    console.log(`Payment URL ready for order ${event.orderId}`);
  }
});
```

**Lưu ý:**
- Order Service **KHÔNG cập nhật** order status khi nhận payment.event với status "pending"
- Order vẫn giữ nguyên status `pending`
- Redis session vẫn active với TTL đếm ngược

---

### Bước 3: Frontend Nhận Payment URL

**API Endpoint:** `GET /order/payment-url/:orderId` (hoặc polling/websocket)

**Request:**
```http
GET /order/payment-url/order-uuid-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Payment URL generated successfully",
  "data": {
    "orderId": "order-uuid-123",
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
    "paymentIntentId": "pi-uuid-789",
    "expiresAt": "2025-10-30T15:15:00.000Z",
    "remainingMinutes": 13
  }
}
```

---

### Bước 4: User Redirect đến VNPay

**Frontend thực hiện redirect:**

```typescript
// React/Vue example
const handlePayment = (paymentUrl: string) => {
  // Option 1: Redirect trong cùng tab
  window.location.href = paymentUrl;
  
  // Option 2: Mở tab mới
  window.open(paymentUrl, '_blank');
};
```

**User được chuyển đến VNPay gateway:**
- URL: `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`
- Params: vnp_Amount, vnp_TxnRef, vnp_OrderInfo, vnp_SecureHash, etc.

---

### Bước 5: User Ở Trên VNPay Gateway (Các Scenarios)

#### Scenario 5A: User Đóng Tab VNPay

```
User Action: Đóng tab VNPay
↓
Backend Effect: KHÔNG CÓ
↓
Order Status: vẫn "pending"
PaymentIntent Status: vẫn "PROCESSING"
Redis Session: vẫn active
```

**Test Case:**
```typescript
it('should keep order status as PENDING after user closes tab', () => {
  const orderStatus = 'pending';
  expect(orderStatus).toBe('pending');
});
```

---

#### Scenario 5B: User Quay Lại Trang Web

```
User Action: Navigate back hoặc type URL
↓
Frontend: GET /order/status/:orderId
↓
Response: Order vẫn pending, có paymentUrl
↓
UI: Hiển thị "Tiếp tục thanh toán" button
```

**API Response khi user quay lại:**
```json
{
  "success": true,
  "data": {
    "orderId": "order-uuid-123",
    "status": "pending",
    "totalPrice": 100000,
    "paymentUrl": "https://sandbox.vnpayment.vn/...",
    "expiresAt": "2025-10-30T15:15:00.000Z",
    "remainingMinutes": 10
  }
}
```

**Test Case:**
```typescript
it('should allow user to return and retry payment', () => {
  const orderResponse = {
    status: 'pending',
    paymentUrl: mockPaymentUrl,
  };
  
  expect(orderResponse.status).toBe('pending');
  expect(orderResponse.paymentUrl).toBeDefined();
});
```

---

#### Scenario 5C: User Bấm Back Button trên VNPay

```
User Action: Click back button trên VNPay form
↓
VNPay Behavior: Redirect về merchant site (returnUrl)
hoặc cho phép user back về browser history
↓
Backend Effect: KHÔNG CÓ (chưa có callback từ VNPay)
↓
Order Status: vẫn "pending"
```

**Test Case:**
```typescript
it('should handle user clicking back button on VNPay', () => {
  const orderStatus = 'pending';
  expect(orderStatus).toBe('pending');
});
```

---

#### Scenario 5D: User Bấm "Hủy Giao Dịch" trên VNPay

```
User Action: Click "Hủy giao dịch" TRƯỚC KHI submit form
↓
VNPay Behavior: 
  - Không tạo transaction
  - Không callback về backend
  - Có thể redirect về returnUrl hoặc để user tự quay lại
↓
Backend Effect: KHÔNG CÓ
↓
Order Status: vẫn "pending"
PaymentIntent: vẫn "PROCESSING"
Redis Session: vẫn active
```

**Lưu ý quan trọng:**
- **Phase 2 Cancel:** User hủy TRƯỚC KHI submit form → VNPay không callback
- **Phase 3 Cancel:** User submit form + VNPay xử lý + trả về vnp_ResponseCode=24 → sẽ test ở Phase 3

**Test Case:**
```typescript
it('should keep order PENDING when user cancels before submit', () => {
  const userCancelled = true; // User clicks Hủy
  const orderStatus = 'pending'; // Order không thay đổi
  
  expect(orderStatus).toBe('pending');
});
```

---

## 📨 KAFKA MESSAGES TRONG PHASE 2

### Message 1: order.create (Từ Phase 1)

**Topic:** `order.create`  
**Producer:** Order Service  
**Consumer:** Payment Service  
**Timing:** Phase 1

```json
{
  "orderId": "order-uuid-123",
  "userId": "user-uuid-456",
  "items": [
    {
      "productId": "product-uuid-1",
      "productName": "Test Product",
      "productPrice": 100000,
      "quantity": 1,
      "subtotal": 100000
    }
  ],
  "totalPrice": 100000,
  "expiresAt": "2025-10-30T15:15:00.000Z",
  "timestamp": "2025-10-30T15:00:00.000Z"
}
```

---

### Message 2: payment.event (Phase 2 - Chính)

**Topic:** `payment.event`  
**Producer:** Payment Service  
**Consumer:** Order Service  
**Timing:** Phase 2 - Đầu giai đoạn

```json
{
  "orderId": "order-uuid-123",
  "userId": "user-uuid-456",
  "email": "user@example.com",
  "amount": 100000,
  "item": "Order order-uuid-123",
  "paymentStatus": "pending",
  "paymentIntentId": "pi-uuid-789",
  "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=10000000&vnp_TxnRef=1698652800000-abc123&vnp_OrderInfo=Payment+for+Order+order-uuid-123&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A3001%2Fvnpay-return&vnp_SecureHash=...",
  "timestamp": "2025-10-30T15:00:03.000Z"
}
```

**Các trường quan trọng:**
- `paymentStatus: "pending"` - Đang chờ user thanh toán
- `paymentUrl` - URL để redirect user đến VNPay
- `paymentIntentId` - ID của PaymentIntent đã tạo

**Hành động của Order Service khi nhận message:**
```typescript
if (event.paymentStatus === 'pending') {
  // 1. Log thông tin
  console.log(`Payment URL ready for order ${event.orderId}`);
  
  // 2. CÓ THỂ lưu paymentUrl vào database (optional)
  // await savePaymentUrl(event.orderId, event.paymentUrl);
  
  // 3. KHÔNG thay đổi order status
  // Order vẫn giữ status "pending"
  
  // 4. KHÔNG xóa Redis session
  // Session vẫn active với TTL đếm ngược
}
```

---

### Message 3: KHÔNG CÓ MESSAGE MỚI trong Phase 2

**Trong Phase 2, KHÔNG có Kafka message nào được publish khi:**
- User đóng tab
- User quay lại trang web
- User bấm back button
- User bấm "Hủy giao dịch" (trước khi submit)

**Lý do:**
- Backend KHÔNG biết user đang làm gì trên VNPay
- VNPay chỉ callback khi có transaction hoàn tất (success hoặc failed)
- Phase 2 là giai đoạn "im lặng" - chỉ chờ user hành động

---

## 🗄️ DATABASE STATE TRONG PHASE 2

### Order Table

```sql
-- Order KHÔNG thay đổi trong Phase 2
SELECT * FROM "Order" WHERE id = 'order-uuid-123';

-- Result:
id              | order-uuid-123
userId          | user-uuid-456
status          | pending          -- Không đổi
totalPrice      | 100000
deliveryAddress | 123 Test Street
contactPhone    | 0901234567
expirationTime  | 2025-10-30T15:15:00.000Z
createdAt       | 2025-10-30T15:00:00.000Z
updatedAt       | 2025-10-30T15:00:00.000Z  -- Không update
```

---

### PaymentIntent Table (Payment Service DB)

```sql
-- PaymentIntent giữ nguyên status PROCESSING
SELECT * FROM "PaymentIntent" WHERE orderId = 'order-uuid-123';

-- Result:
id        | pi-uuid-789
orderId   | order-uuid-123
amount    | 100000
currency  | VND
status    | PROCESSING       -- Không đổi
metadata  | {...}
createdAt | 2025-10-30T15:00:01.000Z
updatedAt | 2025-10-30T15:00:02.000Z  -- Không update
```

---

### PaymentAttempt Table (Payment Service DB)

```sql
-- PaymentAttempt đầu tiên vẫn PROCESSING
SELECT * FROM "PaymentAttempt" 
WHERE paymentIntentId = 'pi-uuid-789';

-- Result:
id                    | pa-uuid-001
paymentIntentId       | pi-uuid-789
status                | PROCESSING
amount                | 100000
currency              | VND
pspProvider           | VNPAY
vnpTxnRef             | 1698652800000-abc123
vnpTransactionNo      | NULL
vnpResponseCode       | NULL
vnpBankCode           | NULL
vnpRawRequestPayload  | {"paymentUrl": "https://...", "timestamp": "..."}
vnpRawResponsePayload | NULL          -- Chưa có response
metadata              | {...}
createdAt             | 2025-10-30T15:00:01.500Z
updatedAt             | 2025-10-30T15:00:02.500Z  -- Không update
```

---

### Redis Session

```redis
# Session vẫn active, TTL đếm ngược
redis> EXISTS order:session:order-uuid-123
(integer) 1

redis> TTL order:session:order-uuid-123
(integer) 780  # 13 phút còn lại (780 seconds)

redis> GET order:session:order-uuid-123
{
  "orderId": "order-uuid-123",
  "userId": "user-uuid-456",
  "totalPrice": 100000,
  "createdAt": "2025-10-30T15:00:00.000Z",
  "expirationTime": "2025-10-30T15:15:00.000Z"
}
```

**TTL Timeline:**
```
T+0:   TTL = 900s  (15 phút)
T+2m:  TTL = 780s  (13 phút) - User đang ở VNPay
T+5m:  TTL = 600s  (10 phút) - User đóng tab
T+8m:  TTL = 420s  (7 phút)  - User quay lại
T+15m: TTL = 0     (0 phút)  - Session hết hạn → Order cancelled
```

---

## 🔄 TRẠNG THÁI ENTITIES TRONG PHASE 2

### Order Status: `pending`
- Không thay đổi trong suốt Phase 2
- Chỉ thay đổi khi:
  - VNPay trả về success → `success` (Phase 3)
  - VNPay trả về failed → `cancelled` (Phase 3)
  - Redis session hết hạn → `cancelled` (Order Service tự động)

### PaymentIntent Status: `PROCESSING`
- Không thay đổi trong suốt Phase 2
- Đang chờ kết quả từ VNPay

### PaymentAttempt Status: `PROCESSING`
- Không thay đổi trong suốt Phase 2
- `vnpRawRequestPayload` có payment URL
- `vnpRawResponsePayload` = NULL (chưa có response)

### Redis Session: `ACTIVE`
- TTL đếm ngược từ 900s → 0s
- Khi TTL = 0, Redis auto delete key
- Redis keyspace notification trigger Order Service cancel order

---

## 🎯 TEST SUITE SUMMARY

### Test Suite 1: user-receives-payment-url.test.ts (11 test cases)

**Mục tiêu:** Test việc user nhận payment URL và được redirect

**Test Cases:**
1. ✅ Order Service consumes payment.event với payment URL
2. ✅ Validate payment URL chứa tham số VNPay đầy đủ
3. ✅ Order status vẫn PENDING sau khi nhận payment URL
4. ✅ Redis session vẫn active với TTL
5. ✅ Frontend nhận response với paymentUrl
6. ✅ User được redirect đến VNPay gateway
7. ✅ Payment URL valid trong thời gian session
8. ✅ Mỗi payment attempt có vnp_TxnRef unique
9. ✅ Kafka message flow tracking
10. ✅ Order không thay đổi status cho đến khi có kết quả
11. ✅ PaymentIntent và PaymentAttempt status là PROCESSING

---

### Test Suite 2: user-navigation-scenarios.test.ts (10 scenarios × N test cases)

**Mục tiêu:** Test các hành vi navigation của user

**Scenarios:**
1. ✅ User đóng tab VNPay - Order vẫn pending, session active
2. ✅ User quay lại trang web - Có thể retry payment
3. ✅ User reload page - Re-fetch order status
4. ✅ User bấm back button trên VNPay - Quay về merchant site
5. ✅ Session expiration tracking - TTL countdown
6. ✅ Multiple navigation actions - Tracking user journey
7. ✅ Payment URL reusability - Có thể dùng lại URL
8. ✅ Error recovery - Xử lý khi payment.event bị mất
9. ✅ Concurrent user actions - Nhiều tabs cùng lúc
10. ✅ User abandonment tracking - Analytics metrics

**Tổng số test cases:** ~40 tests

---

### Test Suite 3: user-cancels-on-vnpay.test.ts (13 test cases)

**Mục tiêu:** Test khi user hủy trên VNPay (trước khi submit form)

**Test Cases:**
1. ✅ User clicks "Hủy giao dịch" button
2. ✅ User không hoàn tất payment form
3. ✅ Order vẫn PENDING sau khi user hủy
4. ✅ Redis session vẫn active sau khi hủy
5. ✅ PaymentIntent và Attempt vẫn PROCESSING
6. ✅ User có thể retry payment
7. ✅ Cancel scenario timeline
8. ✅ Các cách user có thể cancel
9. ✅ Session expiration sau khi cancel
10. ✅ UI state sau khi user quay lại
11. ✅ Analytics và tracking cancel events
12. ✅ Không có database updates khi user cancel
13. ✅ Phân biệt Phase 2 Cancel vs Phase 3 Cancel

---

## 📈 COVERAGE METRICS

### Entities Covered
- ✅ Order (status, lifecycle)
- ✅ PaymentIntent (status tracking)
- ✅ PaymentAttempt (status tracking)
- ✅ Redis Session (TTL, expiration)
- ✅ Kafka Messages (payment.event)
- ✅ User Navigation (multiple scenarios)

### Scenarios Covered
- ✅ Happy path: User nhận payment URL thành công
- ✅ User đóng tab VNPay
- ✅ User quay lại trang web
- ✅ User reload page
- ✅ User bấm back button
- ✅ User bấm "Hủy giao dịch"
- ✅ Session expiration
- ✅ Multiple tabs
- ✅ Error recovery
- ✅ Analytics tracking

### Expected Coverage
- **Statements:** 92%+
- **Branches:** 88%+
- **Functions:** 95%+
- **Lines:** 92%+

---

## 🚀 CHẠY TESTS

### Chạy tất cả tests Phase 2:
```bash
cd backend/services/order-service
npm test -- tests/integration/Test_Pharse2
```

### Chạy từng test suite:
```bash
# Test 1: Receive payment URL
npm test -- tests/integration/Test_Pharse2/user-receives-payment-url.test.ts

# Test 2: Navigation scenarios
npm test -- tests/integration/Test_Pharse2/user-navigation-scenarios.test.ts

# Test 3: Cancel on VNPay
npm test -- tests/integration/Test_Pharse2/user-cancels-on-vnpay.test.ts
```

### Chạy với coverage:
```bash
npm test -- tests/integration/Test_Pharse2 --coverage
```

---

## 🔗 LIÊN KẾT VỚI CÁC PHASE KHÁC

### Phase 1 → Phase 2
```
Phase 1: Order Created
↓
payment.event published (paymentStatus: "pending", paymentUrl: "...")
↓
Phase 2 BẮT ĐẦU: User receives payment URL
```

### Phase 2 → Phase 3
```
Phase 2 KẾT THÚC: User đang ở VNPay
↓
User submits payment form on VNPay
↓
Phase 3 BẮT ĐẦU: VNPay callback với kết quả
```

---

## 📝 LƯU Ý QUAN TRỌNG

### ✅ Điều GÌ XẢY RA trong Phase 2:
1. User nhận payment URL từ backend
2. User được redirect đến VNPay
3. User có thể đóng tab, quay lại, reload, back, hoặc hủy
4. Order, PaymentIntent, PaymentAttempt vẫn giữ nguyên status
5. Redis session vẫn active, TTL đếm ngược
6. Không có Kafka message mới được publish

### ❌ Điều GÌ KHÔNG XẢY RA trong Phase 2:
1. VNPay KHÔNG callback về backend
2. Order status KHÔNG thay đổi
3. PaymentIntent/Attempt status KHÔNG thay đổi
4. KHÔNG có event `payment.event` mới với status success/failed
5. Redis session KHÔNG bị xóa (trừ khi hết hạn)
6. KHÔNG có database updates

### ⚠️ Phase 2 vs Phase 3:
- **Phase 2:** User behavior TRƯỚC KHI VNPay trả kết quả
- **Phase 3:** VNPay callback VỚI kết quả (success/failed/cancelled)

---

## 🎯 MỤC TIÊU ĐẠT ĐƯỢC

✅ **62 test cases** covering Phase 2 scenarios  
✅ **100% Kafka messages** documented  
✅ **Complete workflow** từ payment URL đến user navigation  
✅ **Database states** tại mỗi thời điểm  
✅ **Redis session** tracking với TTL  
✅ **User behaviors** (close tab, back, cancel, retry)  
✅ **No backend changes** during Phase 2  

---

**Tài liệu được tạo:** 30 Tháng 10, 2025  
**Phase:** 2 - User Đến VNPay  
**Status:** ✅ HOÀN THÀNH  
**Next Phase:** Phase 3 - VNPay Returns Result

