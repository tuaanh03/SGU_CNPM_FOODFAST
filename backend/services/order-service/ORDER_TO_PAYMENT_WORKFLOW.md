# WORKFLOW: ORDER TO PAYMENT PROCESSING

## Tóm tắt Workflow đã triển khai

### Flow chính:
1. **Client → API Gateway → Order Service**: Người dùng gửi giỏ hàng
2. **Order Service**: Tạo Order với trạng thái PENDING
3. **Order Service → Kafka (order.create)**: Gửi event bất đồng bộ
4. **Payment Service Consumer**: Nhận event và xử lý payment
5. **Payment Service**: Tạo PaymentIntent + PaymentAttempt + Gọi VNPay API

---

## Chi tiết triển khai

### 1. Order Service - Create Order (PENDING)

**File**: `/backend/services/order-service/src/controllers/order.ts`

**Function**: `createOrder()`

**Flow**:
```
1. Validate user authentication
2. Validate request body (items, deliveryAddress, contactPhone, note)
3. Calculate order amount từ Product Service
4. Tạo Order với status = "pending"
5. Publish event "order.create" qua Kafka
6. Return response với orderId và status = "pending"
```

**Kafka Event Payload**:
```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "productName": "string",
      "productPrice": number,
      "quantity": number
    }
  ],
  "totalPrice": number,
  "timestamp": "ISO8601"
}
```

---

### 2. Payment Service - Consumer

**File**: `/backend/services/payment-service/src/utils/kafka.ts`

**Function**: `runConsumer()`

**Flow khi nhận event "order.create"**:
```
1. Parse orderData từ Kafka message
2. Validate orderId, userId, totalPrice
3. Gọi createPaymentIntent(orderId, userId, totalPrice, description)
4. Publish event "payment.event" với paymentUrl hoặc failed status
```

---

### 3. Payment Service - Create Payment Intent

**File**: `/backend/services/payment-service/src/utils/kafka.ts`

**Function**: `createPaymentIntent()`

**Logic theo yêu cầu**:
```
Bước 1: Tạo PaymentIntent
  - orderId: reference đến Order
  - amount: totalPrice
  - currency: "VND"
  - status: "REQUIRES_PAYMENT"
  - metadata: {userId, description, createdAt}

Bước 2: Tạo PaymentAttempt đầu tiên
  - paymentIntentId: link đến PaymentIntent
  - amount, currency
  - status: "CREATED"
  - pspProvider: "VNPAY"
  - vnpTxnRef: unique transaction reference
  - metadata: {userId, description, orderId}

Bước 3: Gọi VNPay API
  - processPayment(orderId, userId, amount, description)
  - Nhận paymentUrl từ VNPay

Bước 4: Cập nhật PaymentAttempt và PaymentIntent
  - PaymentAttempt.status = "PROCESSING"
  - PaymentIntent.status = "PROCESSING"
  - Lưu paymentUrl vào vnpRawRequestPayload

Bước 5: Return result
  - success: true/false
  - paymentIntentId
  - paymentAttemptId
  - paymentUrl (nếu thành công)
```

---

## Database Schema

### Order Service

**Order Table**:
```prisma
model Order {
  id              String      @id @default(uuid())
  userId          String?
  status          OrderStatus @default(pending) // pending | success | failed
  totalPrice      Int
  deliveryAddress String?
  contactPhone    String?
  note            String?
  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

**OrderItem Table**:
```prisma
model OrderItem {
  id           String   @id @default(uuid())
  orderId      String
  order        Order    @relation(fields: [orderId], references: [id])
  productId    String
  productName  String
  productPrice Int
  quantity     Int      @default(1)
  createdAt    DateTime @default(now())
}
```

### Payment Service

**PaymentIntent Table**:
```prisma
model PaymentIntent {
  id       String              @id @default(uuid())
  orderId  String              @unique
  amount   Decimal             @db.Decimal(12, 2)
  currency String              @default("VND")
  status   PaymentIntentStatus @default(REQUIRES_PAYMENT)
  metadata Json?
  attempts PaymentAttempt[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**PaymentAttempt Table**:
```prisma
model PaymentAttempt {
  id                    String               @id @default(uuid())
  paymentIntentId       String
  paymentIntent         PaymentIntent        @relation(fields: [paymentIntentId], references: [id])
  status                PaymentAttemptStatus @default(CREATED)
  amount                Decimal              @db.Decimal(12, 2)
  currency              String               @default("VND")
  pspProvider           PSPProvider          @default(VNPAY)
  vnpTxnRef             String               @unique
  vnpTransactionNo      String?
  vnpResponseCode       String?
  vnpBankCode           String?
  vnpRawRequestPayload  Json?
  vnpRawResponsePayload Json?
  metadata              Json?
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt
}
```

---

## Kafka Topics

### Topic: `order.create`
- **Producer**: Order Service
- **Consumer**: Payment Service
- **Purpose**: Trigger payment processing khi có order mới

**Message Format**:
```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "items": [...],
  "totalPrice": number,
  "timestamp": "ISO8601"
}
```

### Topic: `payment.event`
- **Producer**: Payment Service
- **Consumer**: Order Service
- **Purpose**: Cập nhật order status dựa trên payment result

**Message Format**:
```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "email": "string",
  "amount": number,
  "item": "description",
  "paymentStatus": "pending" | "success" | "failed",
  "paymentIntentId": "uuid",
  "paymentUrl": "string" (optional)
}
```

---

## API Endpoints

### Order Service

**POST** `/order/create`
- **Auth**: Required (authMiddleware)
- **Body**:
  ```json
  {
    "items": [
      {
        "productId": "uuid",
        "quantity": number
      }
    ],
    "deliveryAddress": "string",
    "contactPhone": "string",
    "note": "string" (optional)
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Đơn hàng đã được tạo ở trạng thái PENDING, đang xử lý thanh toán",
    "data": {
      "orderId": "uuid",
      "items": [...],
      "totalPrice": number,
      "status": "pending",
      "deliveryAddress": "string",
      "contactPhone": "string",
      "note": "string",
      "createdAt": "ISO8601"
    }
  }
  ```

**GET** `/order/status/:orderId`
- **Auth**: Required
- **Response**: Order details với payment status

**GET** `/order/payment-url/:orderId`
- **Auth**: Required
- **Response**: Payment URL hoặc payment status

**GET** `/order/list`
- **Auth**: Required
- **Query**: `?page=1&limit=10&status=pending`
- **Response**: Paginated list of orders

---

## VNPay Integration

**File**: `/backend/services/payment-service/src/utils/vnpay.ts`

**Function**: `processPayment()`

**Flow**:
```
1. Generate unique vnpTxnRef
2. Create VNPay request parameters
3. Sort parameters and create signature
4. Return paymentUrl for redirect
```

**Return**:
```typescript
{
  success: boolean,
  paymentIntentId: string,
  paymentUrl?: string,
  error?: string
}
```

---

## Testing Workflow

### 1. Tạo Order
```bash
curl -X POST http://localhost:3000/order/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "product-uuid", "quantity": 2}
    ],
    "deliveryAddress": "123 Nguyen Hue, Q1, HCMC",
    "contactPhone": "0901234567",
    "note": "Giao giờ hành chính"
  }'
```

**Expected**: Order được tạo với status = "pending"

### 2. Kiểm tra Kafka Event
- Xem log của Payment Service
- Verify event "order.create" được consume
- Verify PaymentIntent và PaymentAttempt được tạo

### 3. Kiểm tra Payment URL
```bash
curl -X GET http://localhost:3000/order/payment-url/:orderId \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: Nhận được paymentUrl từ VNPay

### 4. Test VNPay Payment
- Mở paymentUrl trong browser
- Thực hiện thanh toán test
- Verify VNPay callback
- Kiểm tra Order status được cập nhật

---

## Environment Variables

### Payment Service (.env)
```env
# VNPay Configuration
VNPAY_TMN_CODE=your_tmn_code
VNPAY_HASH_SECRET=your_hash_secret
VNPAY_API_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3001/vnpay-return

# Kafka
KAFKA_BROKERS=kafka:9092

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/payment_db
```

### Order Service (.env)
```env
# Kafka
KAFKA_BROKERS=kafka:9092

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/order_db

# Product Service (for validation)
PRODUCT_SERVICE_URL=http://api-gateway:3000/api/products
```

---

## Notes

### Không sáng tạo thêm logic
- Workflow đã được triển khai theo đúng yêu cầu
- Không thêm các service mới
- Sử dụng các service và schema có sẵn

### Bất đồng bộ (Async Processing)
- Order Service không chờ Payment Service response
- Communication qua Kafka events
- Order được tạo ngay lập tức với status PENDING
- Payment processing xảy ra bất đồng bộ

### Error Handling
- Nếu Payment Service fail, Order vẫn tồn tại với status PENDING
- PaymentIntent và PaymentAttempt track mọi attempt
- Frontend có thể poll order status hoặc sử dụng WebSocket

---

## Next Steps

### 1. Generate Prisma Client
```bash
cd backend/services/payment-service
npx prisma generate
npx prisma migrate dev
```

### 2. Build Services
```bash
cd backend/services/order-service
npm run build

cd backend/services/payment-service
npm run build
```

### 3. Start Services
```bash
docker-compose up -d
```

### 4. Test Workflow
- Tạo order mới
- Verify payment URL generation
- Test VNPay payment flow
- Verify order status updates

