# VNPay IPN Testing Checklist

## Pre-requisites ✅

- [ ] Đã cài đặt ngrok: `ngrok version`
- [ ] Đã đăng ký tài khoản ngrok và có authtoken
- [ ] Đã xác thực ngrok: `ngrok config add-authtoken YOUR_TOKEN`
- [ ] Đã có VNPay sandbox account (TMN Code, Hash Secret)
- [ ] Docker Desktop đang chạy (cho Kafka, PostgreSQL, Redis)

## Environment Setup ✅

### Backend Services

- [ ] **API Gateway** (Port 3000)
  - [ ] File `.env` đã cấu hình đúng
  - [ ] `pnpm install` thành công
  - [ ] Service chạy được: `pnpm dev`
  - [ ] Health check OK: `curl http://localhost:3000`

- [ ] **Payment Service** (Port 3003)
  - [ ] File `.env` có đầy đủ VNPay config:
    ```env
    VNPAY_TMN_CODE=your_code
    VNPAY_HASH_SECRET=your_secret
    VNPAY_API_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
    VNPAY_RETURN_URL=http://localhost:3000/vnpay_return
    VNPAY_IPN_URL=http://localhost:3000/vnpay_ipn
    FRONTEND_URL=http://localhost:5173
    ```
  - [ ] `pnpm install` thành công
  - [ ] Service chạy được: `pnpm dev`
  - [ ] Health check OK: `curl http://localhost:3003`

- [ ] **Order Service** (Port 3002)
  - [ ] Database migrations đã chạy
  - [ ] Service chạy được
  - [ ] Kafka consumer đang listen

- [ ] **Other Services**
  - [ ] Product Service
  - [ ] Restaurant Service
  - [ ] User Service
  - [ ] Cart Service

### Infrastructure

- [ ] **Kafka** (Port 9092)
  - [ ] Container đang chạy
  - [ ] Topic `payment.result` đã tạo
  - [ ] Test connection: `kafka-console-consumer --topic payment.result`

- [ ] **PostgreSQL** (Port 5432)
  - [ ] Container đang chạy
  - [ ] Database đã tạo
  - [ ] Migrations đã chạy

- [ ] **Redis** (Port 6379)
  - [ ] Container đang chạy
  - [ ] Test connection: `redis-cli ping`

### Frontend

- [ ] **React App** (Port 5173)
  - [ ] `pnpm install` thành công
  - [ ] App chạy được: `pnpm dev`
  - [ ] Truy cập được: http://localhost:5173

## Ngrok Setup ✅

- [ ] Chạy ngrok: `./start-ngrok.sh` hoặc `ngrok http 3000`
- [ ] Ngrok đang active, có output:
  ```
  Forwarding  https://abc123.ngrok.io -> http://localhost:3000
  ```
- [ ] Copy URL ngrok: `https://abc123.ngrok.io`
- [ ] Cập nhật vào `backend/services/payment-service/.env`:
  ```env
  VNPAY_RETURN_URL=https://abc123.ngrok.io/vnpay_return
  VNPAY_IPN_URL=https://abc123.ngrok.io/vnpay_ipn
  ```
- [ ] Restart Payment Service để áp dụng thay đổi
- [ ] Mở Ngrok Web Interface: http://127.0.0.1:4040
- [ ] Test ngrok: `curl https://abc123.ngrok.io`

## Testing Flow ✅

### 1. Tạo đơn hàng

- [ ] Login vào frontend
- [ ] Chọn nhà hàng
- [ ] Thêm món vào giỏ hàng
- [ ] Checkout
- [ ] Chọn phương thức thanh toán VNPay

### 2. Tạo payment URL

- [ ] Frontend gọi API tạo payment
- [ ] Check log Payment Service:
  ```
  Processing payment for order: abc-123
  VNPay payment URL generated
  ```
- [ ] Frontend redirect đến VNPay
- [ ] URL VNPay có dạng: `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_...`

### 3. Thanh toán trên VNPay Sandbox

- [ ] Trang VNPay mở thành công
- [ ] Chọn ngân hàng test: NCB
- [ ] Nhập thông tin test:
  - Số thẻ: `9704198526191432198`
  - Tên chủ thẻ: `NGUYEN VAN A`
  - Ngày phát hành: `07/15`
  - OTP: `123456`
- [ ] Click thanh toán

### 4. Verify Return URL callback

- [ ] VNPay redirect về `https://abc123.ngrok.io/vnpay_return?vnp_ResponseCode=00&...`
- [ ] Check Ngrok Web Interface (http://127.0.0.1:4040):
  - [ ] Có request `GET /vnpay_return`
  - [ ] Status: 302 (redirect)
- [ ] Check API Gateway log:
  ```
  GET /vnpay_return 302
  ```
- [ ] Check Payment Service log:
  ```
  VNPAY return callback received: { vnp_ResponseCode: '00', ... }
  VNPay return - OrderId: abc-123, Status: success
  Published payment result event for order abc-123: success
  ```
- [ ] Frontend redirect đến payment result page
- [ ] Hiển thị "Thanh toán thành công"

### 5. Verify IPN callback

- [ ] Check Ngrok Web Interface:
  - [ ] Có request `GET /vnpay_ipn` (sau Return URL)
  - [ ] Status: 200
  - [ ] Response body: `{"RspCode":"00","Message":"success"}`
- [ ] Check API Gateway log:
  ```
  GET /vnpay_ipn 200
  ```
- [ ] Check Payment Service log:
  ```
  VNPAY IPN callback received: { vnp_ResponseCode: '00', ... }
  VNPay signature verification: { match: true }
  VNPay IPN - OrderId: abc-123, Status: success
  [IPN] Published payment result event for order abc-123: success
  ```

### 6. Verify Order update

- [ ] Check Order Service log:
  ```
  Consumed payment result event: { orderId: 'abc-123', status: 'success' }
  Order abc-123 updated to status: paid
  ```
- [ ] Query database:
  ```sql
  SELECT id, status, payment_status FROM orders WHERE id = 'abc-123';
  -- Expected: status = 'paid'
  ```
- [ ] Check frontend: Order history hiển thị order đã thanh toán

### 7. Verify Kafka

- [ ] Mở Kafka consumer:
  ```bash
  docker exec -it kafka kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic payment.result \
    --from-beginning
  ```
- [ ] Thấy message:
  ```json
  {
    "orderId": "abc-123",
    "status": "success",
    "paymentIntentId": "1234567890",
    "amount": 100000
  }
  ```

## Security Testing ✅

### Test signature verification

- [ ] **Test 1: Valid signature**
  - Thanh toán bình thường
  - IPN được xử lý thành công
  - Response: `{"RspCode":"00"}`

- [ ] **Test 2: Invalid signature**
  - Thử modify query params trong IPN URL
  - Payment Service reject request
  - Response: `{"RspCode":"97","Message":"Invalid signature"}`
  - Log: `VNPay signature verification: { match: false }`

- [ ] **Test 3: Replay attack**
  - Gửi lại IPN request đã cũ
  - System xử lý idempotent (không tạo duplicate)

## Edge Cases Testing ✅

### Test user không quay về (chỉ có IPN)

- [ ] User thanh toán thành công trên VNPay
- [ ] User đóng browser ngay (không quay về Return URL)
- [ ] IPN vẫn được gọi và xử lý
- [ ] Order status vẫn được update
- [ ] User xem lại order history, thấy order đã thanh toán

### Test network timeout

- [ ] Tạm stop Payment Service
- [ ] VNPay gọi IPN
- [ ] Ngrok timeout
- [ ] Restart Payment Service
- [ ] VNPay retry IPN (nếu không nhận được response)

### Test failed payment

- [ ] Thanh toán trên VNPay
- [ ] Click "Hủy giao dịch"
- [ ] Return URL: `vnp_ResponseCode != 00`
- [ ] IPN callback với response code khác 00
- [ ] Order status = `failed`
- [ ] Frontend hiển thị "Thanh toán thất bại"

## Performance Testing ✅

- [ ] **Response time**
  - IPN handler phải trả response < 10 giây
  - VNPay timeout sau 10-30 giây
  
- [ ] **Concurrent requests**
  - Test với nhiều orders cùng lúc
  - Kafka consumer xử lý hết events
  
- [ ] **Database load**
  - Check slow queries
  - Index đầy đủ trên orders table

## Monitoring ✅

### Logs to monitor

- [ ] API Gateway: Request logs
- [ ] Payment Service: IPN processing logs
- [ ] Order Service: Order update logs
- [ ] Kafka: Consumer lag

### Metrics to track

- [ ] IPN callback success rate
- [ ] Average processing time
- [ ] Failed signature verifications
- [ ] Kafka message processing time
- [ ] Order update success rate

### Alerts to setup (future)

- [ ] IPN callback failure > 5%
- [ ] Signature verification failure > 1%
- [ ] Kafka consumer lag > 100 messages
- [ ] Payment Service down
- [ ] Order Service down

## Cleanup ✅

After testing:

- [ ] Stop ngrok: `Ctrl+C`
- [ ] Stop all services
- [ ] Clean up test orders từ database (nếu cần)
- [ ] Review logs for any errors

## Common Issues & Solutions ✅

### ❌ Ngrok URL expired
- **Solution**: Restart ngrok, cập nhật .env, restart Payment Service

### ❌ Signature verification failed
- **Solution**: Check VNPAY_HASH_SECRET, đảm bảo không có space/newline

### ❌ IPN không được gọi
- **Solution**: 
  - Check ngrok web interface
  - Verify VNPAY_IPN_URL trong .env
  - Test ngrok: `curl https://abc123.ngrok.io`

### ❌ Order không được update
- **Solution**:
  - Check Kafka consumer logs
  - Verify topic `payment.result` exists
  - Check Order Service consumer

### ❌ Frontend không redirect về
- **Solution**:
  - Check FRONTEND_URL trong .env
  - Verify frontend đang chạy trên đúng port

## Success Criteria ✅

Test thành công khi:

- [x] User hoàn thành thanh toán trên VNPay
- [x] Return URL redirect về frontend
- [x] IPN callback được nhận và xử lý
- [x] Signature verification pass
- [x] Event được publish lên Kafka
- [x] Order status được update thành `paid`
- [x] Frontend hiển thị kết quả thanh toán
- [x] Không có error trong logs

## Notes

- **Ngrok free plan**: URL thay đổi mỗi lần restart
- **VNPay sandbox**: Test không tốn tiền thật
- **IPN retry**: VNPay sẽ retry nếu không nhận response 200
- **Idempotency**: System nên xử lý trường hợp VNPay gọi IPN nhiều lần

