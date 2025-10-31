# 📋 TỔNG HỢP TEST CASES - ORDER SERVICE PHASE 2

## 🎯 TỔNG QUAN

Document này tổng hợp tất cả test cases đã viết cho **Order Service - Phase 2** theo đúng workflow hiện tại của project.

### Đặc điểm Test Cases:
- ✅ **Import hàm thật** từ project (không mock)
- ✅ **Sử dụng Redis thật** để test session management
- ✅ **Sử dụng Prisma thật** để test database operations
- ✅ **Test workflow thực tế** theo tài liệu Phase 2
- ✅ **Không mock các phần quan trọng** - đảm bảo test fail khi code thay đổi

---

## 📂 CẤU TRÚC TEST FILES

```
backend/services/order-service/tests/integration/Test_Pharse2/
├── user-receives-payment-url.test.ts       (8 scenarios, 16 tests)
├── user-navigation-scenarios.test.ts       (10 scenarios, 26 tests)
├── user-cancels-on-vnpay.test.ts          (10 scenarios, 29 tests)
├── session-and-retry-logic.test.ts        (10 scenarios, 33 tests)
└── Docs/
    └── TEST_CASES_SUMMARY.md              (file này)
```

**Tổng số:** 104 test cases

---

## 📝 FILE 1: user-receives-payment-url.test.ts

### Mục đích:
Test workflow khi user nhận payment URL từ Payment Service và được redirect đến VNPay.

### Scenarios & Test Cases:

#### Scenario 1: Order Service nhận payment.event từ Kafka
- **TC1.1**: Payment event chứa paymentUrl và paymentStatus = pending
- **TC1.2**: Payment URL chứa đầy đủ tham số VNPay bắt buộc

**Kiến thức test:**
- Validate cấu trúc Kafka event `payment.event`
- Kiểm tra payment URL có các tham số: `vnp_Amount`, `vnp_TxnRef`, `vnp_OrderInfo`, `vnp_ReturnUrl`, `vnp_SecureHash`

---

#### Scenario 2: Redis Session vẫn active sau khi nhận payment URL
- **TC2.1**: Tạo Redis session thành công
- **TC2.2**: Session có TTL đúng (15 phút = 900 giây)
- **TC2.3**: Session data chứa đầy đủ thông tin (orderId, userId, totalPrice, createdAt, expirationTime)
- **TC2.4**: Session không bị xóa khi nhận payment URL

**Hàm thật được test:**
```typescript
import { 
  createOrderSession, 
  checkOrderSession, 
  getOrderSession, 
  deleteOrderSession 
} from '../../../src/utils/redisSessionManager';
```

**Kỹ thuật:**
- Tạo session với `createOrderSession()`
- Verify bằng `checkOrderSession()` và `getOrderSession()`
- Check TTL trực tiếp với `redisClient.ttl()`

---

#### Scenario 3: Order status vẫn PENDING sau khi nhận payment URL
- **TC3.1**: Order không thay đổi status khi nhận payment.event với status pending
- **TC3.2**: Session không bị xóa khi order status = pending

**Logic test:**
```typescript
// Trong handlePaymentEvent(), khi paymentStatus = 'pending':
if (orderStatus === 'success' || orderStatus === 'cancelled') {
  await deleteOrderSession(testOrderId); 
  // KHÔNG chạy vì orderStatus = pending
}
```

---

#### Scenario 4: User có thể nhận payment URL từ Frontend
- **TC4.1**: Payment URL được lưu hoặc có thể query được
- **TC4.2**: Payment URL expires cùng lúc với session

**Workflow:**
1. Frontend polling `GET /order/payment-url/:orderId`
2. Payment URL valid trong 15 phút (cùng TTL với session)

---

#### Scenario 5: Mỗi payment attempt có vnp_TxnRef unique
- **TC5.1**: vnp_TxnRef phải unique cho mỗi attempt
- **TC5.2**: vnp_TxnRef format đúng (timestamp-orderIdPrefix)

**Format:** `${Date.now()}-${orderId.substring(0, 8)}`

---

#### Scenario 6: PaymentIntent và PaymentAttempt status = PROCESSING
- **TC6.1**: PaymentIntent status không thay đổi trong Phase 2
- **TC6.2**: PaymentAttempt status = PROCESSING khi có payment URL
- **TC6.3**: PaymentAttempt chứa paymentUrl trong metadata

**Entity states:**
- PaymentIntent: `PROCESSING`
- PaymentAttempt: `PROCESSING`
- `vnpRawRequestPayload`: Có payment URL
- `vnpRawResponsePayload`: NULL (chưa có response)

---

#### Scenario 7: Kafka message flow tracking
- **TC7.1**: order.create đã được publish trong Phase 1
- **TC7.2**: payment.event được publish từ Payment Service

**Message flow:**
```
Phase 1: order.create (Order Service → Kafka)
Phase 2: payment.event (Payment Service → Kafka)
```

---

#### Scenario 8: Không có database updates trong Phase 2
- **TC8.1**: Order.updatedAt không thay đổi sau khi nhận payment URL
- **TC8.2**: Không có SQL UPDATE statement nào được thực thi

**Lý do:** Backend chỉ log payment URL, không update database

---

## 📝 FILE 2: user-navigation-scenarios.test.ts

### Mục đích:
Test các hành vi navigation của user khi đang trong quá trình thanh toán (đóng tab, quay lại, reload, back, etc.)

### Scenarios & Test Cases:

#### Scenario 1: User đóng tab VNPay
- **TC1.1**: Order status vẫn PENDING sau khi user đóng tab
- **TC1.2**: Redis session vẫn active sau khi user đóng tab
- **TC1.3**: TTL vẫn đếm ngược sau khi đóng tab
- **TC1.4**: PaymentIntent và PaymentAttempt status không đổi

**Kỹ thuật test:**
```typescript
const ttlBefore = await getSessionTTL(testOrderId);
await new Promise(resolve => setTimeout(resolve, 2000)); // Đợi 2 giây
const ttlAfter = await getSessionTTL(testOrderId);
expect(ttlAfter).toBeLessThan(ttlBefore);
```

---

#### Scenario 2: User quay lại trang web
- **TC2.1**: User có thể query order status
- **TC2.2**: Session vẫn active khi user quay lại
- **TC2.3**: User có thể thấy thời gian còn lại của session
- **TC2.4**: Frontend có thể hiển thị nút "Tiếp tục thanh toán"

**Frontend logic:**
```typescript
const shouldShowContinueButton = 
  orderStatus === 'pending' && sessionExists;
```

---

#### Scenario 3: User reload page
- **TC3.1**: Session vẫn tồn tại sau khi reload
- **TC3.2**: Order data có thể được fetch lại
- **TC3.3**: TTL tiếp tục đếm ngược sau reload

---

#### Scenario 4: User bấm Back button trên VNPay
- **TC4.1**: VNPay có thể redirect về returnUrl
- **TC4.2**: Order status vẫn pending khi user back
- **TC4.3**: Session không bị xóa khi user back

---

#### Scenario 5: Session expiration tracking
- **TC5.1**: Session có TTL đếm ngược từ 900s
- **TC5.2**: Session tự động expire sau 15 phút
- **TC5.3**: Có thể tính remaining time từ TTL

**Test auto-expiration:**
```typescript
// Tạo session với TTL ngắn
await redisClient.setex(key, 1, JSON.stringify(sessionData));
await new Promise(resolve => setTimeout(resolve, 2000));
const exists = await redisClient.exists(key);
expect(exists).toBe(0); // Session đã expire
```

---

#### Scenario 6: Multiple navigation actions
- **TC6.1**: User có thể đóng và mở lại nhiều lần
- **TC6.2**: Session data không thay đổi qua các navigation

---

#### Scenario 7: Payment URL reusability
- **TC7.1**: User có thể sử dụng lại cùng payment URL
- **TC7.2**: Payment URL expires cùng với session

---

#### Scenario 8: Error recovery
- **TC8.1**: Xử lý khi không tìm thấy session
- **TC8.2**: Xử lý khi session data bị corrupt

**Test error handling:**
```typescript
// Lưu data invalid
await redisClient.setex(key, 60, 'invalid-json');
const sessionData = await getOrderSession(orderId);
expect(sessionData).toBeNull(); // Hàm xử lý error
```

---

#### Scenario 9: Concurrent user actions
- **TC9.1**: Session không bị conflict khi query đồng thời
- **TC9.2**: Multiple tabs có thể fetch cùng session data

**Test concurrency:**
```typescript
const promises = [
  checkOrderSession(orderId),
  checkOrderSession(orderId),
  checkOrderSession(orderId)
];
const results = await Promise.all(promises);
expect(results.every(r => r === true)).toBe(true);
```

---

#### Scenario 10: User abandonment tracking
- **TC10.1**: Có thể track thời gian user ở VNPay
- **TC10.2**: Có thể log analytics khi user quay lại

---

## 📝 FILE 3: user-cancels-on-vnpay.test.ts

### Mục đích:
Test khi user hủy giao dịch trên VNPay **TRƯỚC KHI submit form** (Phase 2 Cancel)

### Phân biệt Phase 2 vs Phase 3 Cancel:

| Đặc điểm | Phase 2 Cancel | Phase 3 Cancel |
|----------|----------------|----------------|
| **Thời điểm** | Trước khi submit | Sau khi submit |
| **VNPay tạo transaction** | ❌ Không | ✅ Có |
| **VNPay callback** | ❌ Không | ✅ Có (vnp_ResponseCode=24) |
| **Backend biết user cancel** | ❌ Không | ✅ Có |
| **Order status** | pending | cancelled |
| **Session** | Vẫn active | Bị xóa |
| **Có thể retry** | ✅ Có | ❌ Không |

### Scenarios & Test Cases:

#### Scenario 1: User clicks "Hủy giao dịch" trước khi submit
- **TC1.1**: Order vẫn PENDING khi user cancel trước submit
- **TC1.2**: Không có VNPay callback khi user cancel trước submit
- **TC1.3**: Backend không biết user đã cancel

---

#### Scenario 2: Session vẫn active sau khi user cancel
- **TC2.1**: Redis session không bị xóa khi user cancel
- **TC2.2**: TTL vẫn đếm ngược sau khi cancel
- **TC2.3**: Session chỉ expire khi hết TTL

---

#### Scenario 3: User có thể retry payment sau khi cancel
- **TC3.1**: Session còn active cho phép retry
- **TC3.2**: User có thể click "Thanh toán lại"
- **TC3.3**: Retry sẽ tạo PaymentAttempt mới

---

#### Scenario 4: PaymentIntent và PaymentAttempt không đổi
- **TC4.1**: PaymentIntent status vẫn PROCESSING
- **TC4.2**: PaymentAttempt status vẫn PROCESSING
- **TC4.3**: PaymentAttempt không có vnpResponseCode

---

#### Scenario 5: Phân biệt Phase 2 Cancel vs Phase 3 Cancel
- **TC5.1**: Phase 2 Cancel: User cancel TRƯỚC KHI submit
- **TC5.2**: Phase 3 Cancel: User cancel SAU KHI submit
- **TC5.3**: Key difference: VNPay callback có hay không

---

#### Scenario 6: Cancel timeline và expiration
- **TC6.1**: Session expiration không bị ảnh hưởng bởi cancel
- **TC6.2**: User có thể cancel và retry trong cùng session

---

#### Scenario 7: Các cách user có thể "cancel" trên VNPay
- **TC7.1**: Click button "Hủy giao dịch"
- **TC7.2**: Click Back button trên browser
- **TC7.3**: Đóng tab VNPay
- **TC7.4**: Không hoàn tất form (bỏ trống)
- **TC7.5**: Tất cả các cách trên đều không trigger callback

---

#### Scenario 8: UI State sau khi user cancel và quay lại
- **TC8.1**: Order status hiển thị "Chờ thanh toán"
- **TC8.2**: Hiển thị thời gian còn lại
- **TC8.3**: Hiển thị nút "Tiếp tục thanh toán"

---

#### Scenario 9: Analytics và tracking
- **TC9.1**: Log cancel event (optional)
- **TC9.2**: Track conversion funnel

---

#### Scenario 10: Không có database updates
- **TC10.1**: Không có UPDATE query nào được thực thi
- **TC10.2**: Order.updatedAt không thay đổi
- **TC10.3**: PaymentIntent không được update

---

## 📝 FILE 4: session-and-retry-logic.test.ts

### Mục đích:
Test logic quản lý Redis session và retry payment workflow

### Scenarios & Test Cases:

#### Scenario 1: Redis Session Management
- **TC1.1**: Tạo session với đầy đủ thông tin
- **TC1.2**: Session có expiration time chính xác
- **TC1.3**: Có thể check session existence
- **TC1.4**: Có thể lấy session data
- **TC1.5**: Có thể xóa session manually
- **TC1.6**: Có thể get TTL của session

**Hàm được test:**
```typescript
import { 
  createOrderSession,
  checkOrderSession,
  getOrderSession,
  deleteOrderSession,
  getSessionTTL
} from '../../../src/utils/redisSessionManager';
```

---

#### Scenario 2: Session Deletion Rules
- **TC2.1**: Session KHÔNG bị xóa khi order status = pending
- **TC2.2**: Session BỊ XÓA khi order status = success
- **TC2.3**: Session BỊ XÓA khi order status = cancelled
- **TC2.4**: Session auto-delete khi hết TTL

**Logic:**
```typescript
if (orderStatus === 'success' || orderStatus === 'cancelled') {
  await deleteOrderSession(orderId); // ✅ XÓA
} else if (orderStatus === 'pending') {
  // ❌ KHÔNG XÓA - để user retry
}
```

---

#### Scenario 3: Retry Payment Conditions
- **TC3.1**: Có thể retry khi order status = pending và session tồn tại
- **TC3.2**: KHÔNG thể retry khi order status = success
- **TC3.3**: KHÔNG thể retry khi order status = cancelled
- **TC3.4**: KHÔNG thể retry khi session expired

**Điều kiện retry:**
```typescript
const canRetry = orderStatus === 'pending' && sessionExists;
```

---

#### Scenario 4: Retry Payment Event
- **TC4.1**: Retry event có flag isRetry = true
- **TC4.2**: Retry event được publish vào topic order.retry.payment
- **TC4.3**: Retry event chứa thông tin order đầy đủ

**Kafka topic:**
- Initial payment: `order.create`
- Retry payment: `order.retry.payment`

---

#### Scenario 5: Retry vs Initial Payment
- **TC5.1**: Initial payment có isRetry = undefined hoặc false
- **TC5.2**: Retry payment có isRetry = true
- **TC5.3**: Payment Service xử lý khác nhau giữa initial và retry

**Payment Service logic:**
```typescript
if (event.isRetry) {
  // Tìm PaymentIntent cũ
  // Tạo PaymentAttempt mới
  // KHÔNG check inventory
} else {
  // Tạo PaymentIntent mới
  // Check inventory
}
```

---

#### Scenario 6: PaymentIntent Reuse
- **TC6.1**: 1 Order chỉ có 1 PaymentIntent
- **TC6.2**: Mỗi retry tạo PaymentAttempt mới
- **TC6.3**: Mỗi attempt có vnp_TxnRef unique

**Relationship:**
```
Order (1) → PaymentIntent (1) → PaymentAttempts (N)
```

---

#### Scenario 7: Session TTL và Retry Window
- **TC7.1**: Retry chỉ valid trong thời gian session
- **TC7.2**: Không thể retry sau khi session expire
- **TC7.3**: Remaining time ảnh hưởng đến retry UX

---

#### Scenario 8: Error Handling khi Retry
- **TC8.1**: Xử lý khi session không tồn tại
- **TC8.2**: Xử lý khi order không phải pending
- **TC8.3**: Xử lý khi TTL <= 0

**Error messages:**
- "Phiên thanh toán đã hết hạn"
- "Đơn hàng không ở trạng thái chờ thanh toán"

---

#### Scenario 9: Multiple Retry Attempts
- **TC9.1**: User có thể retry nhiều lần trong session
- **TC9.2**: Mỗi retry tạo event mới
- **TC9.3**: Session TTL giảm dần qua mỗi retry

---

#### Scenario 10: Inventory KHÔNG được check lại khi retry
- **TC10.1**: Initial payment check inventory
- **TC10.2**: Retry payment KHÔNG check inventory
- **TC10.3**: Inventory đã được reserve từ lần đầu

**Lý do:** Inventory đã được reserve khi `order.create` (Phase 1)

---

## 🎯 TỔNG HỢP COVERAGE

### Entities Được Test:
- ✅ **Order** (status lifecycle, không update trong Phase 2)
- ✅ **Redis Session** (create, check, get, delete, TTL)
- ✅ **PaymentIntent** (status tracking, reuse)
- ✅ **PaymentAttempt** (multiple attempts, unique vnp_TxnRef)
- ✅ **Kafka Events** (payment.event, order.retry.payment)

### Workflows Được Test:
1. **Order → Payment URL**: User nhận payment URL từ Payment Service
2. **User Navigation**: Đóng tab, quay lại, reload, back button
3. **User Cancel**: Cancel trước submit (Phase 2)
4. **Session Management**: TTL, expiration, deletion rules
5. **Retry Payment**: Conditions, events, PaymentAttempt creation

### Functions Được Import và Test Thật:
```typescript
// Redis Session Manager
import { 
  createOrderSession,
  checkOrderSession,
  getOrderSession,
  deleteOrderSession,
  getSessionTTL
} from '../../../src/utils/redisSessionManager';

// Kafka
import { 
  publishEvent,
  publishRetryPaymentEvent
} from '../../../src/utils/kafka';

// Prisma
import prisma from '../../../src/lib/prisma';

// Redis Client
import redisClient from '../../../src/lib/redis';
```

### Test Statistics:
- **Tổng số test files**: 4
- **Tổng số scenarios**: 38
- **Tổng số test cases**: 104
- **Sử dụng Redis thật**: ✅
- **Import hàm thật**: ✅
- **Mock các hàm quan trọng**: ❌ (theo yêu cầu)

---

## 🚀 HƯỚNG DẪN CHẠY TESTS

### Chạy tất cả tests Phase 2:
```bash
cd backend/services/order-service
npm test -- tests/integration/Test_Pharse2
```

### Chạy từng file test:
```bash
# Test 1: User receives payment URL
npm test -- tests/integration/Test_Pharse2/user-receives-payment-url.test.ts

# Test 2: User navigation scenarios
npm test -- tests/integration/Test_Pharse2/user-navigation-scenarios.test.ts

# Test 3: User cancels on VNPay
npm test -- tests/integration/Test_Pharse2/user-cancels-on-vnpay.test.ts

# Test 4: Session and retry logic
npm test -- tests/integration/Test_Pharse2/session-and-retry-logic.test.ts
```

### Chạy với coverage:
```bash
npm test -- tests/integration/Test_Pharse2 --coverage
```

### Chạy với watch mode:
```bash
npm test -- tests/integration/Test_Pharse2 --watch
```

---

## 📌 LƯU Ý QUAN TRỌNG

### ✅ Điều Test ĐÚNG:
1. **Import hàm thật** từ project
2. **Sử dụng Redis thật** để test session
3. **Không mock Redis operations**
4. **Không mock Kafka publish** (test payload structure)
5. **Test workflow thực tế** theo tài liệu

### ❌ Điều KHÔNG Test:
1. Không test VNPay callback (Phase 3)
2. Không test order status update (Phase 3)
3. Không test database updates (không có trong Phase 2)
4. Không mock các hàm quan trọng

### 🔍 Tại Sao Không Mock:
> "Nếu mock các hàm, mock các phần quan trọng thì sau này code có thay đổi thì test vẫn pass => điều này không hợp lý"

**Giải pháp:**
- Import và test hàm thật
- Sử dụng Redis thật (có thể dùng Docker)
- Test fail khi logic thay đổi

---

## 🔗 LIÊN KẾT VỚI CÁC PHASE KHÁC

### Phase 1 → Phase 2:
```
Phase 1 kết thúc: Order created, payment.event published
↓
Phase 2 bắt đầu: User receives payment URL
```

### Phase 2 → Phase 3:
```
Phase 2 kết thúc: User đang ở VNPay
↓
Phase 3 bắt đầu: VNPay callback với kết quả
```

---

## 📅 METADATA

- **Document Version**: 1.0
- **Created Date**: 31 Tháng 10, 2025
- **Phase**: Phase 2 - User Đến VNPay
- **Total Test Cases**: 104
- **Test Strategy**: Integration tests với Redis thật, không mock
- **Language**: TypeScript with Jest
- **Coverage Target**: >90%

---

**✅ TÀI LIỆU ĐÃ HOÀN THÀNH**

