# 🚀 Quick Start: Order to Payment Workflow

## Workflow đã triển khai

```
Client → Order Service → Kafka (order.create) → Payment Service
                ↓                                      ↓
          Order (PENDING)                    PaymentIntent + PaymentAttempt
                                                       ↓
                                                  VNPay API
                                                       ↓
                                               PaymentURL (return)
```

## 📝 Những gì đã thay đổi

### 1. Order Service (`order.ts`)
- ✅ **createOrder()** tạo Order với status = `"pending"`
- ✅ Publish event `order.create` qua Kafka (bất đồng bộ)
- ✅ Return ngay với orderId mà không chờ payment

### 2. Payment Service (`kafka.ts`)
- ✅ **createPaymentIntent()** - Logic mới:
  - Tạo PaymentIntent (status: REQUIRES_PAYMENT)
  - Tạo PaymentAttempt đầu tiên (status: CREATED)
  - Gọi VNPay API để lấy paymentUrl
  - Cập nhật status → PROCESSING
- ✅ **runConsumer()** - Subscribe topic `order.create`
- ✅ Publish event `payment.event` với paymentUrl

### 3. Prisma Client (`prisma.ts`)
- ✅ Tạo file `/backend/services/payment-service/src/lib/prisma.ts`

## 🔧 Setup trước khi chạy

### 1. Generate Prisma Client (Payment Service)
```bash
cd backend/services/payment-service
npx prisma generate
npx prisma migrate dev
```

### 2. Build TypeScript
```bash
# Order Service
cd backend/services/order-service
npm run build

# Payment Service
cd backend/services/payment-service
npm run build
```

### 3. Start Services
```bash
docker-compose up -d
```

## 🧪 Test Workflow

### Cách 1: Sử dụng script tự động
```bash
# Cập nhật USER_TOKEN trong file script
nano test-order-to-payment-workflow.sh

# Chạy test
./test-order-to-payment-workflow.sh
```

### Cách 2: Test thủ công

#### Step 1: Tạo Order
```bash
curl -X POST http://localhost:3000/order/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "product-uuid", "quantity": 2}
    ],
    "deliveryAddress": "123 Nguyen Hue, Q1, HCMC",
    "contactPhone": "0901234567"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Đơn hàng đã được tạo ở trạng thái PENDING, đang xử lý thanh toán",
  "data": {
    "orderId": "uuid-here",
    "status": "pending",
    ...
  }
}
```

#### Step 2: Kiểm tra Payment URL
```bash
curl -X GET http://localhost:3000/order/payment-url/{orderId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
}
```

#### Step 3: Mở Payment URL trong browser và thanh toán

#### Step 4: Kiểm tra Order Status sau thanh toán
```bash
curl -X GET http://localhost:3000/order/status/{orderId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Kiểm tra Log

### Order Service Log
```bash
docker logs -f order-service
```
Expected output:
```
Processing payment for order {orderId}
Đơn hàng đã được tạo ở trạng thái PENDING
Published event to order.create
```

### Payment Service Log
```bash
docker logs -f payment-service
```
Expected output:
```
Consumer is listening to order.create
Processing payment for order {orderId}
PaymentIntent created: {paymentIntentId} for order {orderId}
PaymentAttempt created: {paymentAttemptId} for PaymentIntent {paymentIntentId}
VNPay payment URL created for order {orderId}
Payment URL sent for order {orderId}: https://sandbox.vnpayment.vn/...
```

## 🗃️ Database Tables

### Payment Service - Kiểm tra PaymentIntent
```sql
SELECT * FROM "PaymentIntent" WHERE "orderId" = 'your-order-id';
```

### Payment Service - Kiểm tra PaymentAttempt
```sql
SELECT * FROM "PaymentAttempt" WHERE "paymentIntentId" = 'your-payment-intent-id';
```

### Order Service - Kiểm tra Order
```sql
SELECT * FROM "Order" WHERE id = 'your-order-id';
```

## 🔍 Troubleshooting

### Issue: Order được tạo nhưng không có PaymentIntent

**Nguyên nhân**: Kafka event không được consume

**Giải pháp**:
1. Kiểm tra Kafka đang chạy: `docker ps | grep kafka`
2. Kiểm tra Payment Service consumer log
3. Restart Payment Service: `docker-compose restart payment-service`

### Issue: PrismaClient import error

**Nguyên nhân**: Prisma client chưa được generate

**Giải pháp**:
```bash
cd backend/services/payment-service
npx prisma generate
npm run build
docker-compose restart payment-service
```

### Issue: PaymentAttempt tạo thành công nhưng không có paymentUrl

**Nguyên nhân**: VNPay configuration chưa đúng

**Giải pháp**:
1. Kiểm tra `.env` file của Payment Service:
   ```env
   VNPAY_TMN_CODE=your_tmn_code
   VNPAY_HASH_SECRET=your_hash_secret
   VNPAY_API_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
   VNPAY_RETURN_URL=http://localhost:3001/vnpay-return
   ```
2. Verify VNPay credentials
3. Check Payment Service logs for VNPay errors

## 📚 Tài liệu chi tiết

- **Workflow chi tiết**: Xem `ORDER_TO_PAYMENT_WORKFLOW.md`
- **VNPay setup**: Xem `VNPAY_README.md`
- **Testing guide**: Xem `VNPAY_TESTING_QUICK_START.md`

## ✅ Checklist

- [ ] Prisma client đã generate cho Payment Service
- [ ] Services đã build thành công
- [ ] Docker containers đang chạy
- [ ] Kafka đang hoạt động
- [ ] VNPay credentials đã cấu hình
- [ ] Test tạo order thành công
- [ ] PaymentIntent và PaymentAttempt được tạo
- [ ] PaymentURL được generate
- [ ] Test thanh toán VNPay thành công
- [ ] Order status được cập nhật sau thanh toán

## 🎯 Summary

Workflow này đã triển khai đúng theo yêu cầu:
- ✅ Client → Order Service: Tạo Order PENDING
- ✅ Order Service → Payment Service: Gửi event bất đồng bộ qua Kafka
- ✅ Payment Service: Tạo PaymentIntent + PaymentAttempt + Gọi VNPay API
- ✅ Không thêm logic sáng tạo, sử dụng đúng services có sẵn
- ✅ Follow đúng database schema đã định nghĩa

**Workflow hoàn toàn bất đồng bộ và scalable!** 🚀

