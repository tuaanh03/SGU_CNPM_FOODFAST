# 🧪 Integration Test Scenarios: Order Service → Payment Service

## Tổng quan Architecture & Data Flow

```
┌──────────┐    HTTP     ┌───────────────┐    Kafka      ┌──────────────────┐    HTTP      ┌──────────┐
│  Client  │ ─────────> │ Order Service │ ──────────>  │ Payment Service  │ ──────────> │  VNPay   │
│          │            │   (Port 3002) │              │   (Port 3003)    │             │   PSP    │
└──────────┘            └───────────────┘              └──────────────────┘             └──────────┘
                               │                                │
                               ↓                                ↓
                        ┌──────────────┐              ┌──────────────────┐
                        │  PostgreSQL  │              │   PostgreSQL     │
                        │  Order DB    │              │  Payment DB      │
                        └──────────────┘              └──────────────────┘
                               
                        Kafka Topics:
                        - order.create (Order → Payment)
                        - payment.event (Payment → Order)
```

---

## 📋 Test Scenarios Categories

### 1. **Happy Path Tests** (Success Flows)
### 2. **Error Handling Tests** (Failure Flows)
### 3. **Edge Cases Tests** (Boundary Conditions)
### 4. **Session Management Tests** (Timeout & Expiry)
### 5. **Kafka Integration Tests** (Event-Driven)
### 6. **VNPay Integration Tests** (PSP Integration)
### 7. **End-to-End Tests** (Complete Workflow)

---

## 1️⃣ Happy Path Tests (Success Flows)

### Test Case 1.1: Create Order from Cart → Payment URL Generated Successfully

**Description:** Test complete flow từ tạo order từ cart đến nhận payment URL

**Preconditions:**
- User đã login (có valid JWT token)
- Cart có items hợp lệ
- Product Service có sản phẩm available
- Kafka đang chạy
- VNPay sandbox credentials valid

**Test Steps:**
```typescript
// Step 1: Setup cart data
POST /api/cart/add
{
  "storeId": "store-123",
  "productId": "prod-001",
  "quantity": 2
}

// Step 2: Create order from cart
POST /api/orders/create-from-cart
{
  "storeId": "store-123",
  "deliveryAddress": "123 Nguyen Hue St, District 1, HCMC",
  "contactPhone": "0901234567",
  "note": "No onions please"
}
```

**Expected Results:**
1. Order Service:
   - ✅ Order created with status: `pending`
   - ✅ OrderSession created with 15 minutes expiry
   - ✅ Kafka event `order.create` published
   - ✅ Cart cleared after order creation
   - ✅ Response contains orderId and sessionId

2. Payment Service (via Kafka):
   - ✅ Receives `order.create` event
   - ✅ Creates PaymentIntent with status: `REQUIRES_PAYMENT`
   - ✅ Creates PaymentAttempt with status: `CREATED`
   - ✅ Calls VNPay API to generate payment URL
   - ✅ Updates PaymentAttempt to `PROCESSING`
   - ✅ Publishes `payment.event` with paymentUrl

3. VNPay:
   - ✅ Payment URL generated successfully
   - ✅ URL contains correct parameters (amount, orderId, etc.)

**Assertions:**
```typescript
expect(response.status).toBe(201);
expect(response.data.success).toBe(true);
expect(response.data.data.orderId).toBeDefined();
expect(response.data.data.status).toBe('pending');
expect(response.data.data.session.status).toBe('active');
expect(response.data.data.session.expiresAt).toBeGreaterThan(Date.now());
```

**Verification:**
```sql
-- Check Order in database
SELECT * FROM "Order" WHERE id = 'order-id';
-- Expected: status = 'pending'

-- Check OrderSession
SELECT * FROM "OrderSession" WHERE orderId = 'order-id';
-- Expected: status = 'active', expiresAt > now()

-- Check PaymentIntent
SELECT * FROM "PaymentIntent" WHERE orderId = 'order-id';
-- Expected: status = 'PROCESSING'

-- Check PaymentAttempt
SELECT * FROM "PaymentAttempt" WHERE paymentIntentId = 'payment-intent-id';
-- Expected: status = 'PROCESSING', vnpTxnRef exists
```

---

### Test Case 1.2: Create Order Directly (Not from Cart) → Payment URL Generated

**Description:** Test tạo order trực tiếp với items trong request body

**Test Steps:**
```typescript
POST /api/orders/create
{
  "items": [
    {
      "productId": "prod-001",
      "quantity": 2
    },
    {
      "productId": "prod-002",
      "quantity": 1
    }
  ],
  "deliveryAddress": "456 Le Loi St, District 3, HCMC",
  "contactPhone": "0987654321",
  "note": "Extra spicy"
}
```

**Expected Results:**
- Similar to Test Case 1.1 but cart is not involved
- Order created directly from items array
- Payment flow proceeds normally

---

### Test Case 1.3: Get Order Status Returns Correct Information

**Description:** Test lấy trạng thái order sau khi tạo

**Test Steps:**
```typescript
GET /api/orders/{orderId}/status
Headers: { Authorization: "Bearer {token}" }
```

**Expected Results:**
```json
{
  "success": true,
  "data": {
    "orderId": "order-uuid",
    "status": "pending",
    "totalPrice": 150000,
    "items": [...],
    "createdAt": "2025-10-29T10:30:00Z",
    "updatedAt": "2025-10-29T10:30:00Z"
  }
}
```

---

### Test Case 1.4: Get Payment URL Returns VNPay URL

**Description:** Test endpoint lấy payment URL sau khi đơn hàng được xử lý

**Test Steps:**
```typescript
GET /api/orders/{orderId}/payment-url
Headers: { Authorization: "Bearer {token}" }
```

**Expected Results:**
- If payment URL ready: Return URL
- If still processing: Return "pending" status
- If failed: Return error message

---

### Test Case 1.5: VNPay Payment Success Callback Updates Order Status

**Description:** Test callback từ VNPay sau khi user thanh toán thành công

**Test Steps:**
```typescript
// VNPay redirects to:
GET /vnpay_return?vnp_Amount=15000000&vnp_BankCode=NCB&vnp_ResponseCode=00&vnp_TxnRef={txnRef}&vnp_SecureHash={hash}
```

**Expected Results:**
1. Payment Service:
   - ✅ Validates VNPay signature
   - ✅ Updates PaymentAttempt to `SUCCESS`
   - ✅ Updates PaymentIntent to `COMPLETED`
   - ✅ Publishes `payment.event` with status: `success`

2. Order Service:
   - ✅ Receives `payment.event`
   - ✅ Updates Order status to `success`
   - ✅ Updates OrderSession to `completed`

**Verification:**
```sql
SELECT status FROM "Order" WHERE id = 'order-id';
-- Expected: 'success'

SELECT status FROM "OrderSession" WHERE orderId = 'order-id';
-- Expected: 'completed'

SELECT status FROM "PaymentIntent" WHERE orderId = 'order-id';
-- Expected: 'COMPLETED'
```

---

## 2️⃣ Error Handling Tests (Failure Flows)

### Test Case 2.1: Create Order with Empty Cart → Return Error

**Description:** Test tạo order khi cart rỗng

**Test Steps:**
```typescript
POST /api/orders/create-from-cart
{
  "storeId": "store-123",
  "deliveryAddress": "123 St",
  "contactPhone": "0901234567"
}
```

**Expected Results:**
```json
{
  "success": false,
  "message": "Giỏ hàng trống"
}
```

**Assertions:**
```typescript
expect(response.status).toBe(400);
expect(response.data.success).toBe(false);
expect(response.data.message).toContain('trống');
```

---

### Test Case 2.2: Create Order with Unavailable Product → Return Error

**Description:** Test tạo order với sản phẩm không còn kinh doanh

**Preconditions:**
- Product có `isAvailable = false` trong database

**Expected Results:**
```json
{
  "success": false,
  "message": "Giỏ hàng có lỗi",
  "errors": [
    {
      "productId": "prod-001",
      "error": "Sản phẩm không còn kinh doanh"
    }
  ]
}
```

---

### Test Case 2.3: Create Order with Insufficient Stock → Return Error

**Description:** Test tạo order khi số lượng yêu cầu > stock

**Expected Results:**
```json
{
  "success": false,
  "message": "Sản phẩm không đủ hàng. Còn lại: 5, yêu cầu: 10"
}
```

---

### Test Case 2.4: Create Order without Authentication → Return 401

**Description:** Test tạo order không có JWT token

**Test Steps:**
```typescript
POST /api/orders/create-from-cart
// No Authorization header
```

**Expected Results:**
```json
{
  "success": false,
  "message": "Unauthorized: No user ID found"
}
```

**Assertions:**
```typescript
expect(response.status).toBe(401);
```

---

### Test Case 2.5: VNPay Payment Failure → Update Order Status to Failed

**Description:** Test callback từ VNPay khi thanh toán thất bại

**Test Steps:**
```typescript
GET /vnpay_return?vnp_ResponseCode=24&vnp_TxnRef={txnRef}&...
// ResponseCode 24 = Transaction cancelled by user
```

**Expected Results:**
1. Payment Service:
   - ✅ Updates PaymentAttempt to `FAILED`
   - ✅ Publishes `payment.event` with status: `failed`

2. Order Service:
   - ✅ Updates Order status to `failed`
   - ✅ OrderSession remains `active` (allow retry if not expired)

---

### Test Case 2.6: Invalid VNPay Signature → Reject Payment

**Description:** Test VNPay callback với signature không hợp lệ

**Expected Results:**
```json
{
  "success": false,
  "message": "Invalid VNPay signature"
}
```

---

### Test Case 2.7: Kafka Connection Lost → Handle Gracefully

**Description:** Test xử lý khi Kafka unavailable

**Preconditions:**
- Stop Kafka container: `docker stop kafka`

**Expected Results:**
- Order Service: Return 500 error với message "Kafka unavailable"
- Order should NOT be created in database
- No data inconsistency

---

### Test Case 2.8: Payment Service Down → Order Creation Fails

**Description:** Test tạo order khi Payment Service không available

**Preconditions:**
- Stop Payment Service: `docker stop payment-service`

**Expected Results:**
- Kafka event published but no consumer
- Order remains in `pending` state
- Frontend should show "Payment processing delayed"

---

## 3️⃣ Edge Cases Tests (Boundary Conditions)

### Test Case 3.1: Create Order with Maximum Items (100 items)

**Description:** Test với số lượng items lớn

**Test Steps:**
```typescript
POST /api/orders/create
{
  "items": [ /* 100 items */ ],
  "deliveryAddress": "...",
  "contactPhone": "..."
}
```

**Expected Results:**
- Order created successfully if totalPrice valid
- Payment URL generated correctly

---

### Test Case 3.2: Create Order with Very Large Amount (>1 billion VND)

**Description:** Test với số tiền rất lớn

**Expected Results:**
- Should validate amount limits
- VNPay may have maximum transaction amount

---

### Test Case 3.3: Create Order with Minimum Amount (1 VND)

**Description:** Test với số tiền tối thiểu

**Expected Results:**
- Order created successfully
- VNPay URL generated with vnp_Amount=100 (1 VND * 100)

---

### Test Case 3.4: Create Order with Special Characters in Address

**Description:** Test với ký tự đặc biệt

**Test Steps:**
```typescript
POST /api/orders/create-from-cart
{
  "deliveryAddress": "123 Nguyễn Văn Cừ, Quận 5, TP.HCM <script>alert('xss')</script>",
  "contactPhone": "0901234567"
}
```

**Expected Results:**
- Should sanitize special characters
- No XSS vulnerability

---

### Test Case 3.5: Create Multiple Orders Simultaneously (Race Condition)

**Description:** Test concurrent order creation

**Test Steps:**
```typescript
// Send 10 concurrent requests
Promise.all([
  createOrder(),
  createOrder(),
  // ... 8 more
]);
```

**Expected Results:**
- All 10 orders created successfully
- No database deadlock
- Each order has unique ID

---

## 4️⃣ Session Management Tests (Timeout & Expiry)

### Test Case 4.1: Order Session Expires After 15 Minutes

**Description:** Test session tự động expire

**Test Steps:**
1. Create order
2. Wait 15 minutes (or mock time)
3. Try to get payment URL

**Expected Results:**
- OrderSession status = `expired`
- Order status = `expired`
- Frontend should show "Order expired, please create new order"

---

### Test Case 4.2: Retry Payment Within Session Time

**Description:** Test retry payment trước khi session expire

**Test Steps:**
1. Create order
2. Payment failed (user cancelled)
3. Call retry payment endpoint within 15 minutes

**Expected Results:**
- New PaymentAttempt created
- paymentAttempts count incremented
- New VNPay URL generated

---

### Test Case 4.3: Maximum Payment Attempts Reached (3 times)

**Description:** Test khi user retry quá 3 lần

**Test Steps:**
1. Create order
2. Fail payment 3 times
3. Try 4th attempt

**Expected Results:**
```json
{
  "success": false,
  "message": "Maximum payment attempts reached. Please create new order"
}
```

- OrderSession status = `cancelled`
- Order status = `failed`

---

### Test Case 4.4: Session Extended on Retry

**Description:** Test gia hạn session khi retry (optional feature)

**Expected Results:**
- If implemented: expiresAt extended by +5 minutes
- If not: session time remains same

---

## 5️⃣ Kafka Integration Tests (Event-Driven)

### Test Case 5.1: Order.create Event Published Successfully

**Description:** Test Kafka event được publish

**Verification:**
```bash
# Listen to Kafka topic
kafka-console-consumer --bootstrap-server localhost:9092 --topic order.create --from-beginning
```

**Expected Message:**
```json
{
  "orderId": "order-uuid",
  "userId": "user-uuid",
  "items": [...],
  "totalPrice": 150000,
  "sessionId": "session-uuid",
  "expiresAt": "2025-10-29T10:45:00Z",
  "timestamp": "2025-10-29T10:30:00Z"
}
```

---

### Test Case 5.2: Payment.event Consumed by Order Service

**Description:** Test Order Service nhận event từ Payment Service

**Verification:**
- Check Order Service logs for "Received payment event"
- Verify Order status updated in database

---

### Test Case 5.3: Kafka Message Retry on Failure

**Description:** Test retry logic khi consumer xử lý thất bại

**Expected Results:**
- Message reprocessed up to 10 times (based on Kafka config)
- After 10 retries, message sent to dead letter queue (if configured)

---

### Test Case 5.4: Kafka Consumer Lag Monitoring

**Description:** Test consumer không bị lag

**Verification:**
```bash
kafka-consumer-groups --bootstrap-server localhost:9092 --group payment-service-group --describe
```

**Expected Results:**
- LAG should be 0 or minimal
- Current offset close to log end offset

---

## 6️⃣ VNPay Integration Tests (PSP Integration)

### Test Case 6.1: VNPay URL Parameters are Correct

**Description:** Validate tất cả parameters trong VNPay URL

**Expected Parameters:**
```
vnp_Version=2.1.0
vnp_Command=pay
vnp_TmnCode={valid_code}
vnp_Amount={amount*100}
vnp_CreateDate={YYYYMMDDHHmmss}
vnp_CurrCode=VND
vnp_IpAddr={client_ip}
vnp_Locale=vn
vnp_OrderInfo=Order {orderId} - {itemCount} items
vnp_OrderType=other
vnp_ReturnUrl={return_url}
vnp_TxnRef={unique_txn_ref}
vnp_SecureHash={valid_hmac_sha512}
```

---

### Test Case 6.2: VNPay Signature Validation

**Description:** Test signature được tạo đúng

**Verification:**
```typescript
// Extract params from URL
const params = new URLSearchParams(paymentUrl);
const secureHash = params.get('vnp_SecureHash');

// Recreate signature
const signData = /* sorted params */;
const expectedHash = crypto.createHmac('sha512', secret).update(signData).digest('hex');

expect(secureHash).toBe(expectedHash);
```

---

### Test Case 6.3: VNPay IPN (Instant Payment Notification)

**Description:** Test VNPay gọi IPN endpoint

**Test Steps:**
```typescript
POST /vnpay_ipn
{
  vnp_Amount: "15000000",
  vnp_BankCode: "NCB",
  vnp_ResponseCode: "00",
  vnp_TxnRef: "...",
  vnp_SecureHash: "..."
}
```

**Expected Results:**
- Validate signature
- Update PaymentAttempt
- Return success response to VNPay

---

### Test Case 6.4: VNPay Response Codes Handling

**Description:** Test xử lý các response codes từ VNPay

**Response Codes:**
- `00`: Success
- `07`: Trừ tiền thành công nhưng chưa giao dịch
- `09`: Giao dịch không thành công do thẻ chưa đăng ký dịch vụ
- `10`: Thẻ hết hạn
- `11`: Thẻ bị khóa
- `12`: Thẻ không đủ số dư
- `24`: Giao dịch bị hủy bởi người dùng
- `51`: Tài khoản không đủ số dư
- `65`: Tài khoản đã vượt quá giới hạn giao dịch
- `75`: Ngân hàng đang bảo trì
- `79`: Sai OTP
- `99`: Lỗi không xác định

**Expected Handling:**
- Map each code to appropriate PaymentAttempt status
- User-friendly error messages

---

## 7️⃣ End-to-End Tests (Complete Workflow)

### Test Case 7.1: Complete Order Flow from Cart to Payment Success

**Description:** Test toàn bộ flow từ đầu đến cuối

**Test Steps:**
1. User login
2. Add items to cart
3. Create order from cart
4. Get payment URL
5. Simulate VNPay payment success
6. Verify order status updated
7. Verify cart cleared

**Duration:** ~30 seconds

---

### Test Case 7.2: Complete Order Flow with Payment Failure and Retry

**Description:** Test flow với payment fail và retry thành công

**Test Steps:**
1. Create order
2. First payment failed (user cancelled)
3. Retry payment within session time
4. Second payment success
5. Verify order status = success

---

### Test Case 7.3: Multi-User Concurrent Orders

**Description:** Test nhiều users tạo orders đồng thời

**Test Steps:**
1. 10 users login simultaneously
2. Each user creates an order
3. All payments processed

**Expected Results:**
- All 10 orders created successfully
- No race conditions
- Database consistency maintained

---

## 📊 Test Coverage Metrics

### Unit Tests
- [ ] Order Controller functions: 80%+
- [ ] Payment Service functions: 80%+
- [ ] Helper functions: 90%+

### Integration Tests
- [ ] Order → Payment flow: 100%
- [ ] Kafka messaging: 90%+
- [ ] Database operations: 85%+

### E2E Tests
- [ ] Complete workflows: 5 main scenarios
- [ ] Error scenarios: 10 edge cases

---

## 🛠️ Test Implementation Tools

### Testing Frameworks
```json
{
  "jest": "^29.0.0",
  "supertest": "^6.3.0",
  "@testcontainers/postgresql": "^10.0.0",
  "@testcontainers/kafka": "^10.0.0",
  "nock": "^13.0.0"
}
```

### Mock Services
- Mock VNPay API responses
- Mock Kafka producer/consumer
- Mock Product Service responses
- Mock Cart Service responses

### Test Databases
- Use Testcontainers for PostgreSQL
- Use in-memory Kafka for unit tests
- Separate test database for integration tests

---

## 🚀 Running Tests

### Unit Tests
```bash
cd backend/services/order-service
npm run test:unit

cd backend/services/payment-service
npm run test:unit
```

### Integration Tests
```bash
# Start test infrastructure
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration
```

### E2E Tests
```bash
# Start all services
docker-compose up -d

# Run E2E tests
npm run test:e2e
```

---

## 📝 Test Data Fixtures

### Sample Order
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "items": [
    {
      "productId": "prod-001",
      "productName": "Burger",
      "productPrice": 50000,
      "quantity": 2
    }
  ],
  "totalPrice": 100000,
  "deliveryAddress": "123 Test St",
  "contactPhone": "0901234567"
}
```

### Sample VNPay Response
```json
{
  "vnp_Amount": "10000000",
  "vnp_BankCode": "NCB",
  "vnp_ResponseCode": "00",
  "vnp_TxnRef": "1698483045123-a1b2c3d4e",
  "vnp_SecureHash": "valid_hash_here"
}
```

---

## 🔍 Monitoring & Debugging

### Log Points to Check
1. **Order Service:**
   - Order creation logs
   - Kafka publish logs
   - Session creation logs

2. **Payment Service:**
   - Kafka consume logs
   - PaymentIntent creation logs
   - VNPay API call logs
   - Payment event publish logs

3. **Kafka:**
   - Message produced/consumed
   - Consumer lag
   - Partition assignment

### Health Check Endpoints
```bash
GET /health          # Order Service
GET /health          # Payment Service
GET /kafka/health    # Kafka status
```

---

## ✅ Test Execution Checklist

- [ ] All services running
- [ ] Database migrations applied
- [ ] Kafka topics created
- [ ] Test data seeded
- [ ] Environment variables set
- [ ] VNPay sandbox credentials configured
- [ ] Run unit tests: PASS
- [ ] Run integration tests: PASS
- [ ] Run E2E tests: PASS
- [ ] Check code coverage: >80%
- [ ] Review test logs for errors
- [ ] Cleanup test data

---

## 📚 References

- [Kafka Testing Best Practices](https://kafka.apache.org/documentation/#testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [VNPay API Documentation](https://sandbox.vnpayment.vn/apis/)

---

**Last Updated:** October 29, 2025
**Maintained by:** Development Team

