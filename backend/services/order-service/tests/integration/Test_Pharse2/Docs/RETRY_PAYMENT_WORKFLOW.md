# 🔄 RETRY PAYMENT WORKFLOW - CHI TIẾT QUY TRÌNH

## 📋 MỤC LỤC

1. [Tổng Quan Retry Payment](#tổng-quan-retry-payment)
2. [Workflow Chi Tiết - Step by Step](#workflow-chi-tiết---step-by-step)
3. [Communication Flow](#communication-flow)
4. [Database State Changes](#database-state-changes)
5. [Redis Session Management](#redis-session-management)
6. [Test Coverage Analysis](#test-coverage-analysis)
7. [Các Trường Hợp Chưa Test](#các-trường-hợp-chưa-test)

---

## 🎯 TỔNG QUAN RETRY PAYMENT

### Khi Nào User Retry Payment?

```
Scenario 1: User đóng tab khi đang ở VNPay
  → Quay lại trang order status
  → Click "Thanh toán lại"

Scenario 2: User bấm Back button từ VNPay
  → Về trang merchant
  → Click "Tiếp tục thanh toán"

Scenario 3: User bấm "Hủy giao dịch" trên VNPay
  → VNPay redirect về merchant với response code 24
  → Session vẫn còn → Click "Thử lại"

Scenario 4: Payment timeout trên VNPay
  → User quay lại
  → Session còn hạn → Retry
```

### Key Principles

✅ **PaymentIntent được tái sử dụng** (1 Order = 1 PaymentIntent)  
✅ **PaymentAttempt mới được tạo** (mỗi lần retry = 1 attempt mới)  
✅ **Redis session KHÔNG bị xóa** khi retry  
✅ **Inventory KHÔNG được check lại** (đã reserve từ lần đầu)  
✅ **VNPay URL mới được generate** (vnp_TxnRef khác nhau)

---

## 🔄 WORKFLOW CHI TIẾT - STEP BY STEP

### STEP 1: User Initiates Retry

**Action:** User clicks "Thanh toán lại" button

**Frontend:**
```typescript
POST /order/retry-payment/:orderId
Headers: {
  Authorization: "Bearer <JWT_TOKEN>"
}
```

**Request:**
```json
{
  "orderId": "order-123-abc"
}
```

---

### STEP 2: Order Service Validates Request

**Controller:** `retryPayment()` in `order-service/src/controllers/order.ts`

#### Validation Checks:

```typescript
// ✅ Check 1: User authenticated
if (!userId) {
  return 401: "Unauthorized"
}

// ✅ Check 2: Order exists and belongs to user
const order = await prisma.order.findUnique({
  where: { id: orderId, userId }
});

if (!order) {
  return 404: "Không tìm thấy đơn hàng"
}

// ✅ Check 3: Order status = pending
if (order.status === "success") {
  return 400: "Đơn hàng đã được thanh toán thành công"
}

if (order.status !== "pending") {
  return 400: "Đơn hàng không ở trạng thái chờ thanh toán"
}

// ✅ Check 4: Redis session exists
const sessionExists = await checkOrderSession(orderId);

if (!sessionExists) {
  // Session hết hạn → Cập nhật order = cancelled
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'cancelled' }
  });
  
  return 400: "Phiên thanh toán đã hết hạn"
}

// ✅ Check 5: Session TTL > 0
const ttlSeconds = await getSessionTTL(orderId);

if (ttlSeconds <= 0) {
  return 400: "Phiên thanh toán đã hết hạn"
}
```

**🔍 Điểm Quan Trọng:**
- ✅ **TTL KHÔNG bị reset** khi retry
- ✅ **Session countdown tiếp tục** từ thời điểm ban đầu
- ✅ **Order status vẫn = pending**

---

### STEP 3: Publish Kafka Event - order.retry.payment

**Order Service publishes:**

```typescript
// utils/kafka.ts - publishRetryPaymentEvent()

Topic: "order.retry.payment"

Payload: {
  orderId: "order-123-abc",
  userId: "user-456-def",
  totalPrice: 100000,
  items: [
    {
      productId: "prod-001",
      productName: "Burger King",
      productPrice: 50000,
      quantity: 2
    }
  ],
  isRetry: true,  // ⭐ FLAG ĐẶC BIỆT
  expiresAt: "2025-10-30T15:00:00Z",
  timestamp: "2025-10-30T14:50:00Z"
}
```

**🎯 Consumers của topic này:**
- ✅ **Payment Service** - Xử lý retry
- ❌ **Inventory Service** - KHÔNG lắng nghe (tránh check lại)
- ❌ **Notification Service** - KHÔNG lắng nghe

---

### STEP 4: Payment Service Consumes Event

**Consumer:** `payment-service/src/utils/kafka.ts`

```typescript
await consumer.subscribe({ topic: "order.retry.payment" });

await consumer.run({
  eachMessage: async ({ topic, message }) => {
    const { orderId, userId, totalPrice, items, isRetry } = JSON.parse(message.value);
    
    const isRetryPayment = topic === "order.retry.payment" || isRetry === true;
    
    if (isRetryPayment) {
      // ⭐ Gọi retryPaymentIntent (KHÔNG phải createPaymentIntent)
      result = await retryPaymentIntent(
        orderId,
        userId,
        totalPrice,
        orderDescription
      );
    } else {
      result = await createPaymentIntent(...);
    }
  }
});
```

---

### STEP 5: Find Existing PaymentIntent

**Function:** `retryPaymentIntent()` in `payment-service/src/utils/kafka.ts`

```typescript
async function retryPaymentIntent(orderId, userId, amount, description) {
  console.log(`🔄 Retrying payment for order ${orderId}`);
  
  // ⭐ Tìm PaymentIntent cũ
  const existingPaymentIntent = await prisma.paymentIntent.findUnique({
    where: { orderId }
  });
  
  if (!existingPaymentIntent) {
    console.error(`PaymentIntent not found. Creating new one...`);
    return await createPaymentIntent(...);  // Fallback
  }
  
  console.log(`✅ Found existing PaymentIntent: ${existingPaymentIntent.id}`);
  
  // Tiếp tục...
}
```

**Database Query:**
```sql
SELECT * FROM PaymentIntent WHERE orderId = 'order-123-abc';

-- Result:
{
  id: 'pi-001',
  orderId: 'order-123-abc',
  userId: 'user-456-def',
  amount: 100000,
  currency: 'VND',
  status: 'PROCESSING',  -- Có thể là REQUIRES_PAYMENT hoặc FAILED
  createdAt: '2025-10-30T14:30:00Z',
  updatedAt: '2025-10-30T14:30:00Z'
}
```

---

### STEP 6: Update PaymentIntent Status (if needed)

```typescript
// Nếu PaymentIntent đang FAILED → Chuyển về REQUIRES_PAYMENT
if (existingPaymentIntent.status === "FAILED") {
  await prisma.paymentIntent.update({
    where: { id: existingPaymentIntent.id },
    data: { status: "REQUIRES_PAYMENT" }
  });
  
  console.log(`✅ Updated PaymentIntent to REQUIRES_PAYMENT`);
}
```

**Database Update:**
```sql
UPDATE PaymentIntent
SET status = 'REQUIRES_PAYMENT', updatedAt = NOW()
WHERE id = 'pi-001' AND status = 'FAILED';
```

---

### STEP 7: Create New PaymentAttempt

```typescript
// ⭐ Tạo PaymentAttempt MỚI (không reuse attempt cũ)
const vnpTxnRef = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const paymentAttempt = await prisma.paymentAttempt.create({
  data: {
    paymentIntentId: existingPaymentIntent.id,  // Link to existing PI
    amount: amount,
    currency: "VND",
    status: "CREATED",
    pspProvider: "VNPAY",
    vnpTxnRef: vnpTxnRef,  // ⭐ MỚI - khác với attempt cũ
    metadata: {
      userId: userId,
      description: description,
      orderId: orderId,
      isRetry: true,  // ⭐ Flag đánh dấu retry
      retryAt: new Date().toISOString()
    }
  }
});

console.log(`✅ Created PaymentAttempt: ${paymentAttempt.id} (retry)`);
```

**Database Insert:**
```sql
INSERT INTO PaymentAttempt (
  id, paymentIntentId, vnpTxnRef, status, amount, currency, 
  pspProvider, metadata, createdAt, updatedAt
)
VALUES (
  'pa-002',
  'pi-001',  -- ⭐ Same PaymentIntent
  '1730304600000-xyz789',  -- ⭐ NEW vnpTxnRef
  'CREATED',
  100000,
  'VND',
  'VNPAY',
  '{"isRetry": true, "retryAt": "2025-10-30T14:50:00Z"}',
  NOW(),
  NOW()
);
```

**⭐ Kết quả:** Bây giờ có 2 PaymentAttempt cho cùng 1 PaymentIntent:

```sql
SELECT * FROM PaymentAttempt WHERE paymentIntentId = 'pi-001';

-- Results:
[
  {
    id: 'pa-001',
    paymentIntentId: 'pi-001',
    vnpTxnRef: '1730301000000-abc123',  -- Attempt 1
    status: 'PROCESSING',
    createdAt: '2025-10-30T14:30:00Z'
  },
  {
    id: 'pa-002',
    paymentIntentId: 'pi-001',
    vnpTxnRef: '1730304600000-xyz789',  -- Attempt 2 (RETRY)
    status: 'CREATED',
    createdAt: '2025-10-30T14:50:00Z',
    metadata: { isRetry: true }
  }
]
```

---

### STEP 8: Generate New VNPay Payment URL

```typescript
// Tạo URL VNPay mới
const vnpayResult = await processPayment(
  orderId,
  userId,
  amount,
  description
);

if (vnpayResult.success && vnpayResult.paymentUrl) {
  // ✅ Cập nhật PaymentAttempt → PROCESSING
  await prisma.paymentAttempt.update({
    where: { id: paymentAttempt.id },
    data: {
      status: "PROCESSING",
      vnpRawRequestPayload: {
        paymentUrl: vnpayResult.paymentUrl,
        timestamp: new Date().toISOString()
      }
    }
  });
  
  // ✅ Cập nhật PaymentIntent → PROCESSING
  await prisma.paymentIntent.update({
    where: { id: existingPaymentIntent.id },
    data: { status: "PROCESSING" }
  });
  
  console.log(`✅ New VNPay URL: ${vnpayResult.paymentUrl}`);
}
```

**VNPay URL Format:**
```
https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?
  vnp_TxnRef=1730304600000-xyz789  ← ⭐ MỚI
  &vnp_Amount=10000000
  &vnp_OrderInfo=Order+order-123-abc
  &vnp_ReturnUrl=http://localhost:3000/payment/vnpay/return
  &...
```

**Database Updates:**
```sql
-- Update PaymentAttempt
UPDATE PaymentAttempt
SET status = 'PROCESSING',
    vnpRawRequestPayload = '{"paymentUrl": "https://...", "timestamp": "..."}',
    updatedAt = NOW()
WHERE id = 'pa-002';

-- Update PaymentIntent
UPDATE PaymentIntent
SET status = 'PROCESSING', updatedAt = NOW()
WHERE id = 'pi-001';
```

---

### STEP 9: Publish payment.event with New URL

**Payment Service publishes:**

```typescript
await publishEvent(
  orderId,
  userId,
  "system@vnpay.com",
  totalPrice,
  orderDescription,
  "pending",  // ⭐ Status = pending
  paymentIntentId,
  vnpayResult.paymentUrl  // ⭐ NEW payment URL
);
```

**Kafka Message:**
```json
Topic: "payment.event"

Payload: {
  orderId: "order-123-abc",
  userId: "user-456-def",
  paymentStatus: "pending",  // ⭐ NOT "failed"
  paymentIntentId: "pi-001",
  paymentUrl: "https://sandbox.vnpayment.vn/...",  // ⭐ NEW URL
  timestamp: "2025-10-30T14:50:05Z"
}
```

---

### STEP 10: Order Service Receives payment.event

**Consumer:** `order-service/src/utils/kafka.ts`

```typescript
await consumer.subscribe({ topic: "payment.event" });

await consumer.run({
  eachMessage: async ({ topic, message }) => {
    const { orderId, paymentStatus, paymentUrl } = JSON.parse(message.value);
    
    if (paymentStatus === "pending" && paymentUrl) {
      // ✅ Order status vẫn = pending
      // ✅ Redis session KHÔNG bị xóa
      // ✅ User nhận được payment URL mới
      
      console.log(`✅ Retry payment URL ready: ${paymentUrl}`);
      
      // Có thể publish order.payment.url.ready để notify frontend
    }
  }
});
```

---

### STEP 11: Frontend Receives New Payment URL

**Response to Client:**
```json
{
  "success": true,
  "message": "Đã tạo URL thanh toán mới",
  "data": {
    "orderId": "order-123-abc",
    "paymentUrl": "https://sandbox.vnpayment.vn/...",
    "expiresAt": "2025-10-30T15:00:00Z",
    "sessionRemainingMinutes": 10,  // ⭐ TTL còn lại
    "isRetry": true
  }
}
```

**Frontend Action:**
```typescript
// Auto-redirect to VNPay
window.location.href = response.data.paymentUrl;

// Or show button
<button onClick={() => window.location.href = paymentUrl}>
  Thanh toán ngay
</button>
```

---

## 🔗 COMMUNICATION FLOW

### Cách PaymentAttempt Thông Báo Cho PaymentIntent

**❌ KHÔNG có communication trực tiếp**

PaymentAttempt và PaymentIntent là **database entities**, không "thông báo" cho nhau. Thay vào đó:

```
PaymentAttempt (pa-002) được tạo
    ↓
Linked to PaymentIntent (pi-001) via paymentIntentId
    ↓
Payment Service cập nhật cả 2:
    ├─ UPDATE PaymentAttempt SET status = 'PROCESSING'
    └─ UPDATE PaymentIntent SET status = 'PROCESSING'
```

**Code Flow:**
```typescript
// STEP 1: Create PaymentAttempt
const paymentAttempt = await prisma.paymentAttempt.create({
  data: {
    paymentIntentId: existingPaymentIntent.id,  // ⭐ Link
    status: "CREATED",
    // ...
  }
});

// STEP 2: Update PaymentAttempt
await prisma.paymentAttempt.update({
  where: { id: paymentAttempt.id },
  data: { status: "PROCESSING" }
});

// STEP 3: Update PaymentIntent
await prisma.paymentIntent.update({
  where: { id: existingPaymentIntent.id },
  data: { status: "PROCESSING" }
});
```

**Database Relationship:**
```prisma
model PaymentIntent {
  id        String   @id
  orderId   String   @unique
  status    String
  attempts  PaymentAttempt[]  // ⭐ One-to-Many
}

model PaymentAttempt {
  id               String   @id
  paymentIntentId  String
  paymentIntent    PaymentIntent @relation(fields: [paymentIntentId], references: [id])
  status           String
}
```

---

### Cách PaymentIntent Thông Báo Cho Order

**✅ Qua Kafka Event: payment.event**

```
Payment Service (PaymentIntent updated)
    ↓
Publish Kafka: payment.event
    ↓
Order Service consumes
    ↓
Update Order status
```

**Chi Tiết:**

```typescript
// Payment Service
async function updatePaymentStatus(paymentIntentId, status) {
  // Update PaymentIntent
  const paymentIntent = await prisma.paymentIntent.update({
    where: { id: paymentIntentId },
    data: { status: status }
  });
  
  // ⭐ Publish Kafka event
  await kafka.publishEvent(
    paymentIntent.orderId,
    paymentIntent.userId,
    ...,
    status,  // "pending", "success", "failed"
    paymentIntentId,
    paymentUrl
  );
}
```

**Kafka Message:**
```json
Topic: "payment.event"

Payload: {
  orderId: "order-123-abc",
  paymentStatus: "pending" | "success" | "failed",
  paymentIntentId: "pi-001",
  // ... other data
}
```

**Order Service Consumes:**
```typescript
// Order Service - Kafka Consumer
await consumer.subscribe({ topic: "payment.event" });

await consumer.run({
  eachMessage: async ({ message }) => {
    const { orderId, paymentStatus } = JSON.parse(message.value);
    
    // Map payment status → order status
    let orderStatus;
    if (paymentStatus === "success") {
      orderStatus = "success";
      await deleteOrderSession(orderId);  // ⭐ Xóa session
    } else if (paymentStatus === "failed") {
      orderStatus = "cancelled";
      await deleteOrderSession(orderId);  // ⭐ Xóa session
    } else {
      orderStatus = "pending";
      // ⭐ KHÔNG xóa session (user có thể retry)
    }
    
    // Update Order
    await prisma.order.update({
      where: { id: orderId },
      data: { status: orderStatus }
    });
  }
});
```

---

## 📊 DATABASE STATE CHANGES

### Before Retry

```sql
-- Order
SELECT * FROM Order WHERE id = 'order-123-abc';
{
  id: 'order-123-abc',
  userId: 'user-456-def',
  status: 'pending',  ← ⭐
  totalPrice: 100000,
  createdAt: '2025-10-30T14:30:00Z'
}

-- PaymentIntent
SELECT * FROM PaymentIntent WHERE orderId = 'order-123-abc';
{
  id: 'pi-001',
  orderId: 'order-123-abc',
  status: 'PROCESSING',  ← ⭐
  amount: 100000
}

-- PaymentAttempt
SELECT * FROM PaymentAttempt WHERE paymentIntentId = 'pi-001';
[
  {
    id: 'pa-001',
    paymentIntentId: 'pi-001',
    status: 'PROCESSING',  ← ⭐
    vnpTxnRef: '1730301000000-abc123',
    createdAt: '2025-10-30T14:30:00Z'
  }
]

-- Redis
redis-cli GET order:session:order-123-abc
{
  orderId: 'order-123-abc',
  userId: 'user-456-def',
  status: 'pending',
  expiresAt: '2025-10-30T15:00:00Z',
  createdAt: '2025-10-30T14:30:00Z'
}

redis-cli TTL order:session:order-123-abc
600  ← ⭐ Còn 10 phút (600 giây)
```

---

### After Retry

```sql
-- Order (KHÔNG THAY ĐỔI)
{
  id: 'order-123-abc',
  status: 'pending',  ← ⭐ SAME
  totalPrice: 100000
}

-- PaymentIntent (status có thể thay đổi)
{
  id: 'pi-001',
  orderId: 'order-123-abc',
  status: 'PROCESSING',  ← ⭐ Có thể từ FAILED → PROCESSING
  amount: 100000,
  updatedAt: '2025-10-30T14:50:00Z'  ← Updated
}

-- PaymentAttempt (MỚI)
[
  {
    id: 'pa-001',
    paymentIntentId: 'pi-001',
    status: 'PROCESSING',  ← Old attempt (vẫn còn)
    vnpTxnRef: '1730301000000-abc123',
    createdAt: '2025-10-30T14:30:00Z'
  },
  {
    id: 'pa-002',  ← ⭐ NEW
    paymentIntentId: 'pi-001',  ← Same PaymentIntent
    status: 'PROCESSING',
    vnpTxnRef: '1730304600000-xyz789',  ← ⭐ NEW vnpTxnRef
    metadata: { isRetry: true },
    createdAt: '2025-10-30T14:50:00Z'  ← ⭐ NEW timestamp
  }
]

-- Redis (KHÔNG BỊ XÓA, TTL GIẢM)
redis-cli GET order:session:order-123-abc
{
  orderId: 'order-123-abc',
  status: 'pending',  ← ⭐ SAME
  expiresAt: '2025-10-30T15:00:00Z'  ← ⭐ SAME
}

redis-cli TTL order:session:order-123-abc
480  ← ⭐ Còn 8 phút (giảm từ 10 phút)
```

**🔍 Key Observations:**

1. ✅ **Order status = pending** (không thay đổi)
2. ✅ **PaymentIntent được reuse** (cùng ID = 'pi-001')
3. ✅ **PaymentAttempt mới được tạo** (pa-002)
4. ✅ **Old PaymentAttempt vẫn tồn tại** (pa-001 không bị xóa)
5. ✅ **Redis session KHÔNG bị xóa**
6. ✅ **Redis TTL countdown tiếp tục** (không reset)

---

## 🔴 REDIS SESSION MANAGEMENT

### Session TTL Behavior During Retry

```
T+0:00  → Order created, session created
         SETEX order:session:xxx 900 {...}
         TTL = 900 seconds (15 phút)

T+5:00  → User at VNPay, decides to cancel
         TTL = 600 seconds (10 phút)
         
T+5:30  → User clicks "Retry Payment"
         ✅ Session exists? YES
         ✅ TTL > 0? YES (TTL = 570)
         ✅ Retry ALLOWED
         ⭐ TTL KHÔNG RESET (vẫn countdown)

T+6:00  → New payment URL ready
         TTL = 540 seconds (9 phút)
         Session: ACTIVE

T+15:00 → Session expires (original expiration)
         Redis auto-deletes key
         Order → cancelled (if not paid)
```

**🔍 Important Points:**

1. ✅ **TTL không reset** khi retry
2. ✅ **Thời gian hết hạn giữ nguyên** từ lúc order tạo
3. ✅ **Session countdown liên tục** (không pause)
4. ✅ **User có thể retry nhiều lần** trong thời gian TTL > 0

### Redis Commands During Retry

```bash
# Before Retry
redis-cli EXISTS order:session:order-123-abc
1  # Session tồn tại

redis-cli TTL order:session:order-123-abc
600  # Còn 10 phút

redis-cli GET order:session:order-123-abc
"{\"orderId\":\"order-123-abc\",\"status\":\"pending\",...}"

# After Retry
redis-cli EXISTS order:session:order-123-abc
1  # ⭐ Vẫn tồn tại (KHÔNG bị xóa)

redis-cli TTL order:session:order-123-abc
540  # ⭐ Giảm xuống còn 9 phút

redis-cli GET order:session:order-123-abc
"{\"orderId\":\"order-123-abc\",\"status\":\"pending\",...}"
# ⭐ Data KHÔNG thay đổi
```

---

## ✅ TEST COVERAGE ANALYSIS

### Các Test Cases Đã Có trong Phase 2

#### 1. ✅ Session TTL Countdown During Retry

**File:** `session-and-retry-logic.test.ts`

```typescript
describe('Test Case 10: Session NOT Deleted on Retry', () => {
  it('should keep Redis session active after retry', () => {
    const sessionTTLBefore = 600;  // Before retry
    const sessionTTLAfter = 600;   // After retry
    
    expect(sessionTTLAfter).toBeGreaterThan(0);
  });
  
  it('should allow multiple retries within session time', () => {
    const retryAttempts = [
      { attemptNumber: 1, sessionTTL: 800 },
      { attemptNumber: 2, sessionTTL: 600 },  // ⭐ TTL giảm dần
      { attemptNumber: 3, sessionTTL: 400 },
    ];
    
    retryAttempts.forEach(attempt => {
      expect(attempt.sessionTTL).toBeGreaterThan(0);
    });
  });
});
```

**✅ Status:** ĐÃ TEST (nhưng giá trị TTL hard-coded, không test thực tế)

---

#### 2. ✅ PaymentIntent Status After Retry

**File:** `user-cancels-on-vnpay.test.ts`

```typescript
describe('Test Case 5: PaymentIntent and Attempt Status After Cancel', () => {
  it('should keep PaymentIntent status as PROCESSING after user cancel', () => {
    const paymentIntent = {
      id: 'pi-001',
      status: 'PROCESSING',  // ⭐ Không thay đổi khi user cancel
    };
    
    expect(paymentIntent.status).toBe('PROCESSING');
    expect(paymentIntent.status).not.toBe('FAILED');
  });
  
  it('should keep PaymentAttempt status as PROCESSING', () => {
    const paymentAttempt = {
      id: 'pa-001',
      status: 'PROCESSING',  // ⭐ Vẫn PROCESSING
    };
    
    expect(paymentAttempt.status).toBe('PROCESSING');
  });
});
```

**✅ Status:** ĐÃ TEST (mock data, không test database thực)

---

#### 3. ✅ Retry Flow Timeline

**File:** `session-and-retry-logic.test.ts`

```typescript
describe('Test Case 11: Complete Retry Flow Timeline', () => {
  it('should track complete retry flow', () => {
    const retryTimeline = [
      { step: 1, action: 'Client POST /retry-payment' },
      { step: 2, action: 'Check session active' },
      { step: 5, action: 'Find PaymentIntent' },
      { step: 6, action: 'Create new PaymentAttempt' },
      { step: 7, action: 'Generate VNPay URL' },
      { step: 8, action: 'Publish payment.event' },
    ];
    
    expect(retryTimeline).toHaveLength(9);
  });
});
```

**✅ Status:** ĐÃ TEST (conceptual flow)

---

## ❌ CÁC TRƯỜNG HỢP CHƯA TEST

### 🔴 HIGH PRIORITY - Cần Test Ngay

#### 1. ❌ TTL Countdown Thực Tế Khi Retry

**Thiếu:**
```typescript
it('should verify actual TTL countdown during retry', async () => {
  // Step 1: Create order → session TTL = 900s
  const orderId = 'test-order-123';
  await createOrderSession(orderId, 900);
  
  const ttl1 = await redis.ttl(`order:session:${orderId}`);
  expect(ttl1).toBeLessThanOrEqual(900);
  expect(ttl1).toBeGreaterThan(0);
  
  // Step 2: Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const ttl2 = await redis.ttl(`order:session:${orderId}`);
  expect(ttl2).toBeLessThan(ttl1);  // ⭐ TTL phải giảm
  expect(ttl2).toBeGreaterThan(ttl1 - 10);  // Giảm ~5s
  
  // Step 3: Retry payment
  await POST('/order/retry-payment/' + orderId);
  
  // Step 4: Check TTL after retry
  const ttl3 = await redis.ttl(`order:session:${orderId}`);
  expect(ttl3).toBeLessThan(ttl2);  // ⭐ TTL tiếp tục giảm
  expect(ttl3).toBeGreaterThan(0);  // ⭐ Vẫn còn hạn
  
  // ⭐ TTL KHÔNG reset về 900
  expect(ttl3).not.toBe(900);
});
```

---

#### 2. ❌ PaymentIntent Status Transitions Khi Retry

**Thiếu:**
```typescript
describe('PaymentIntent Status Transitions on Retry', () => {
  it('should update PaymentIntent from FAILED to REQUIRES_PAYMENT on retry', async () => {
    // Setup: PaymentIntent with FAILED status
    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        orderId: 'order-123',
        userId: 'user-456',
        status: 'FAILED',
        amount: 100000
      }
    });
    
    expect(paymentIntent.status).toBe('FAILED');
    
    // Retry payment
    await POST('/order/retry-payment/order-123');
    
    // Verify: Status changed to REQUIRES_PAYMENT
    const updated = await prisma.paymentIntent.findUnique({
      where: { id: paymentIntent.id }
    });
    
    expect(updated.status).toBe('REQUIRES_PAYMENT');  // ⭐ Changed
  });
  
  it('should keep PaymentIntent status as PROCESSING if already PROCESSING', async () => {
    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        orderId: 'order-456',
        status: 'PROCESSING',
        amount: 100000
      }
    });
    
    await POST('/order/retry-payment/order-456');
    
    const updated = await prisma.paymentIntent.findUnique({
      where: { id: paymentIntent.id }
    });
    
    expect(updated.status).toBe('PROCESSING');  // ⭐ Unchanged
  });
});
```

---

#### 3. ❌ Multiple PaymentAttempts Cho Cùng PaymentIntent

**Thiếu:**
```typescript
it('should create multiple PaymentAttempts for same PaymentIntent on retry', async () => {
  const orderId = 'order-789';
  
  // Create initial PaymentIntent + PaymentAttempt
  const pi = await createPaymentIntent(orderId, 'user-123', 100000);
  
  const attempts1 = await prisma.paymentAttempt.findMany({
    where: { paymentIntentId: pi.id }
  });
  
  expect(attempts1).toHaveLength(1);
  const firstAttempt = attempts1[0];
  
  // Retry payment
  await POST('/order/retry-payment/' + orderId);
  
  // Wait for Payment Service to process
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verify: 2 attempts now
  const attempts2 = await prisma.paymentAttempt.findMany({
    where: { paymentIntentId: pi.id }
  });
  
  expect(attempts2).toHaveLength(2);  // ⭐ NEW attempt created
  
  // Verify: Different vnpTxnRef
  const secondAttempt = attempts2.find(a => a.id !== firstAttempt.id);
  expect(secondAttempt.vnpTxnRef).not.toBe(firstAttempt.vnpTxnRef);  // ⭐ UNIQUE
  
  // Verify: metadata.isRetry = true
  expect(secondAttempt.metadata.isRetry).toBe(true);
});
```

---

#### 4. ❌ PaymentAttempt Status Khi Cancelled

**Thiếu:**
```typescript
describe('PaymentAttempt Status When User Cancels on VNPay', () => {
  it('should keep old PaymentAttempt as PROCESSING when user cancels', async () => {
    // User đến VNPay, bấm cancel (chưa có IPN callback)
    const paymentAttempt = await prisma.paymentAttempt.findUnique({
      where: { id: 'pa-001' }
    });
    
    // ⭐ Status vẫn PROCESSING (chưa có response từ VNPay)
    expect(paymentAttempt.status).toBe('PROCESSING');
    expect(paymentAttempt.status).not.toBe('CANCELED');
  });
  
  it('should update PaymentAttempt to CANCELED when IPN callback received', async () => {
    // Phase 3 scope - VNPay gửi IPN với response code 24
    // Payment Service nhận IPN
    await handleVNPayIPN({
      vnp_TxnRef: 'pa-001',
      vnp_ResponseCode: '24',  // User cancelled
    });
    
    const paymentAttempt = await prisma.paymentAttempt.findUnique({
      where: { vnpTxnRef: 'pa-001' }
    });
    
    expect(paymentAttempt.status).toBe('CANCELED');  // ⭐ Updated
  });
});
```

---

#### 5. ❌ Order Status Không Thay Đổi Khi Retry

**Thiếu:**
```typescript
it('should NOT change Order status when retry payment', async () => {
  const orderId = 'order-999';
  
  // Setup: Order with status = pending
  const order = await prisma.order.create({
    data: {
      id: orderId,
      userId: 'user-123',
      status: 'pending',
      totalPrice: 100000
    }
  });
  
  expect(order.status).toBe('pending');
  
  // Retry payment
  await POST('/order/retry-payment/' + orderId);
  
  // Verify: Order status still pending
  const orderAfter = await prisma.order.findUnique({
    where: { id: orderId }
  });
  
  expect(orderAfter.status).toBe('pending');  // ⭐ UNCHANGED
  expect(orderAfter.status).not.toBe('success');
  expect(orderAfter.status).not.toBe('cancelled');
});
```

---

#### 6. ❌ Inventory Service KHÔNG Xử Lý order.retry.payment

**Thiếu:**
```typescript
it('should verify Inventory Service does NOT process order.retry.payment', async () => {
  // Mock Inventory Service consumer
  const inventoryConsumerMessages = [];
  
  // Inventory Service chỉ subscribe order.create
  await inventoryConsumer.subscribe({ topic: 'order.create' });
  
  // Publish order.retry.payment
  await kafka.publish('order.retry.payment', {
    orderId: 'order-123',
    isRetry: true
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Verify: Inventory Service KHÔNG nhận được message
  expect(inventoryConsumerMessages).toHaveLength(0);  // ⭐ EMPTY
});
```

---

### 🟡 MEDIUM PRIORITY - Nên Test

#### 7. ❌ Multiple Retries - VNPay URL Uniqueness

```typescript
it('should generate unique VNPay URL for each retry', async () => {
  const orderId = 'order-multi-retry';
  
  // Retry 1
  const response1 = await POST('/order/retry-payment/' + orderId);
  const url1 = response1.data.paymentUrl;
  const vnpTxnRef1 = extractVnpTxnRef(url1);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Retry 2
  const response2 = await POST('/order/retry-payment/' + orderId);
  const url2 = response2.data.paymentUrl;
  const vnpTxnRef2 = extractVnpTxnRef(url2);
  
  // Verify: URLs khác nhau
  expect(url1).not.toBe(url2);
  
  // Verify: vnpTxnRef khác nhau
  expect(vnpTxnRef1).not.toBe(vnpTxnRef2);  // ⭐ UNIQUE
});
```

---

#### 8. ❌ Retry Khi Session Sắp Hết Hạn

```typescript
it('should allow retry when session has < 1 minute remaining', async () => {
  const orderId = 'order-last-minute';
  
  // Setup: Session với TTL = 50 giây
  await redis.setex(`order:session:${orderId}`, 50, JSON.stringify({
    orderId,
    status: 'pending',
    expiresAt: new Date(Date.now() + 50000).toISOString()
  }));
  
  // Retry payment
  const response = await POST('/order/retry-payment/' + orderId);
  
  // Verify: Retry được chấp nhận
  expect(response.status).toBe(200);
  expect(response.data.sessionRemainingMinutes).toBeLessThan(1);
  
  // User vẫn nhận được payment URL
  expect(response.data.paymentUrl).toBeDefined();
});
```

---

#### 9. ❌ Retry Rejected Khi Session = 0

```typescript
it('should reject retry when session TTL = 0', async () => {
  const orderId = 'order-expired-retry';
  
  // Setup: Session hết hạn
  await redis.set(`order:session:${orderId}`, JSON.stringify({
    orderId,
    status: 'pending'
  }));
  
  await redis.expire(`order:session:${orderId}`, 0);  // ⭐ TTL = 0
  
  // Try to retry
  const response = await POST('/order/retry-payment/' + orderId);
  
  // Verify: Rejected
  expect(response.status).toBe(400);
  expect(response.data.error).toBe('SESSION_EXPIRED');
  
  // Verify: Order status updated to cancelled
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  expect(order.status).toBe('cancelled');
});
```

---

## 📋 SUMMARY

### ✅ Test Coverage Hiện Tại

| Feature | Tested? | Quality |
|---------|---------|---------|
| Session không bị xóa khi retry | ✅ | Mock (not real Redis) |
| TTL countdown tiếp tục | ✅ | Conceptual (hard-coded values) |
| PaymentIntent status after cancel | ✅ | Mock data |
| Complete retry flow | ✅ | Timeline tracking |
| Kafka topic routing | ✅ | Event structure |

### ❌ Test Gaps (9 cases thiếu)

| Test Case | Priority | Impact |
|-----------|----------|--------|
| 1. TTL countdown thực tế | 🔴 HIGH | Critical |
| 2. PaymentIntent status transitions | 🔴 HIGH | Critical |
| 3. Multiple PaymentAttempts | 🔴 HIGH | Critical |
| 4. PaymentAttempt CANCELED status | 🔴 HIGH | Critical |
| 5. Order status unchanged | 🔴 HIGH | Critical |
| 6. Inventory không xử lý retry | 🔴 HIGH | Important |
| 7. VNPay URL uniqueness | 🟡 MEDIUM | Important |
| 8. Retry khi session sắp hết | 🟡 MEDIUM | Important |
| 9. Retry rejected khi TTL = 0 | 🟡 MEDIUM | Important |

---

## 🎓 KẾT LUẬN

### Communication Summary

```
┌─────────────────────────────────────────────────────────────┐
│           RETRY PAYMENT COMMUNICATION FLOW                   │
└─────────────────────────────────────────────────────────────┘

User (Frontend)
    ↓ POST /retry-payment
Order Service
    ↓ Validates (session, TTL, order status)
    ↓ Publish Kafka: order.retry.payment
Payment Service
    ↓ Consumes order.retry.payment
    ↓ Find PaymentIntent (existing)
    ↓ Update PaymentIntent status (if needed)
    ↓ Create PaymentAttempt (new)
    ↓ Generate VNPay URL (new)
    ↓ Update PaymentAttempt → PROCESSING
    ↓ Update PaymentIntent → PROCESSING
    ↓ Publish Kafka: payment.event (with new URL)
Order Service
    ↓ Consumes payment.event
    ↓ Order status: pending (unchanged)
    ↓ Redis session: ACTIVE (not deleted)
    ↓ Return payment URL to client
User (Frontend)
    ↓ Redirect to VNPay với URL mới
```

### Key Takeaways

1. ✅ **PaymentIntent được tái sử dụng** - 1 Order = 1 PaymentIntent
2. ✅ **PaymentAttempt mới mỗi lần retry** - Track từng lần thử
3. ✅ **Redis session không bị xóa** - User có thể retry nhiều lần
4. ✅ **TTL countdown liên tục** - Không reset khi retry
5. ✅ **Kafka topics tách biệt** - order.create ≠ order.retry.payment
6. ✅ **Inventory không check lại** - Đã reserve từ lần đầu

### Test Recommendations

🔴 **Ưu tiên cao:** Implement 6 test cases HIGH priority  
🟡 **Ưu tiên trung bình:** Implement 3 test cases MEDIUM priority  
💡 **Tương lai:** Thêm integration tests với real Redis & Database

---

**Tài liệu này:** Chi tiết workflow retry payment trong Phase 2  
**Ngày tạo:** 30 Tháng 10, 2025  
**Phase:** 2 - User Đến VNPay  
**Mục đích:** Giải thích communication flow giữa các components  

