# VNPay Local Testing với Ngrok - Tổng hợp

## 📚 Tài liệu

Dự án cung cấp các tài liệu sau để hỗ trợ test VNPay IPN trên local:

1. **[VNPAY_NGROK_GUIDE.md](./VNPAY_NGROK_GUIDE.md)** - Hướng dẫn chi tiết
   - Giải thích về Return URL vs IPN URL
   - Kiến trúc và flow
   - Cài đặt và cấu hình ngrok
   - Troubleshooting
   - Best practices

2. **[VNPAY_TESTING_QUICK_START.md](./VNPAY_TESTING_QUICK_START.md)** - Quick start guide
   - Setup nhanh từng bước
   - Commands cần thiết
   - Kiểm tra logs
   - Công cụ thay thế

3. **[VNPAY_FLOW_DIAGRAMS.md](./VNPAY_FLOW_DIAGRAMS.md)** - Sơ đồ flow
   - Architecture overview
   - Sequence diagrams
   - Signature verification process
   - Error handling flow

4. **[VNPAY_TESTING_CHECKLIST.md](./VNPAY_TESTING_CHECKLIST.md)** - Checklist test
   - Pre-requisites
   - Environment setup
   - Testing flow từng bước
   - Security testing
   - Common issues

5. **[VNPAY_IPN_LOCAL_SETUP.md](./VNPAY_IPN_LOCAL_SETUP.md)** - Setup IPN cho local
   - Giải pháp với ngrok
   - So sánh công cụ khác
   - Nginx config (cho production)

## 🚀 Quick Start

### 1. Cài ngrok

```bash
brew install ngrok
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 2. Start services

```bash
# Terminal 1 - API Gateway
cd backend/services/api-gateway && pnpm dev

# Terminal 2 - Payment Service  
cd backend/services/payment-service && pnpm dev

# Terminal 3 - Other services
docker-compose up
```

### 3. Start ngrok

```bash
# Terminal 4
./start-ngrok.sh
```

Copy URL ngrok (ví dụ: `https://abc123.ngrok.io`)

### 4. Cập nhật .env

File `backend/services/payment-service/.env`:

```env
VNPAY_RETURN_URL=https://abc123.ngrok.io/vnpay_return
VNPAY_IPN_URL=https://abc123.ngrok.io/vnpay_ipn
```

### 5. Restart Payment Service

```bash
# Ctrl+C ở Terminal 2, sau đó
pnpm dev
```

### 6. Test

1. Truy cập frontend: http://localhost:5173
2. Tạo đơn hàng và thanh toán qua VNPay
3. Hoàn thành thanh toán trên sandbox
4. Kiểm tra logs và ngrok web interface

## 📋 Tóm tắt Implementation

### Backend Changes

#### 1. Payment Service - IPN Endpoint

**File:** `backend/services/payment-service/src/server.ts`

- ✅ Added `GET /vnpay_ipn` endpoint
- ✅ Verify VNPay signature
- ✅ Publish event to Kafka
- ✅ Return proper VNPay response format

#### 2. Payment Service - Signature Verification

**File:** `backend/services/payment-service/src/utils/vnpay.ts`

- ✅ Added `verifyVNPaySignature()` function
- ✅ HMAC SHA512 verification
- ✅ Logging for debugging

#### 3. API Gateway - IPN Route

**File:** `backend/services/api-gateway/src/server.ts`

- ✅ Added route `/vnpay_ipn` (without auth)
- ✅ Proxy to Payment Service
- ✅ Updated `proxyReqPathResolver`

### Configuration

#### 1. Environment Variables

**File:** `backend/services/payment-service/.env.example`

- ✅ Added VNPay config
- ✅ Added ngrok URL examples
- ✅ Added comments

### Scripts

#### 1. Ngrok Startup Script

**File:** `start-ngrok.sh`

- ✅ Check ngrok installation
- ✅ Check authentication
- ✅ Start tunnel on port 3000
- ✅ Display instructions

## 🔍 How It Works

### VNPay Callbacks

| Type | URL | Purpose | Required |
|------|-----|---------|----------|
| Return URL | `/vnpay_return` | Redirect user back | Yes |
| IPN URL | `/vnpay_ipn` | Server-to-server callback | Recommended |

### Flow

```
User pays on VNPay
    ↓
VNPay calls IPN → https://abc123.ngrok.io/vnpay_ipn
    ↓
Ngrok forwards → http://localhost:3000/vnpay_ipn
    ↓
API Gateway proxies → http://localhost:3003/vnpay_ipn
    ↓
Payment Service:
    1. Verify signature
    2. Publish to Kafka
    3. Return {"RspCode":"00"}
    ↓
Order Service:
    1. Consume Kafka event
    2. Update order status
```

### Signature Verification

```typescript
// Remove hash fields
params = { ...query }
delete params.vnp_SecureHash

// Sort keys and build sign data
signData = Object.keys(params)
  .sort()
  .map(k => `${k}=${params[k]}`)
  .join('&')

// Calculate HMAC SHA512
calculated = HMAC_SHA512(signData, VNPAY_HASH_SECRET)

// Compare
isValid = (calculated === receivedHash)
```

## 🛠️ Tools

### Ngrok Web Interface

http://127.0.0.1:4040

- View all HTTP requests
- Inspect headers and query params
- See responses
- Replay requests

### Kafka Console Consumer

```bash
docker exec -it kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic payment.result \
  --from-beginning
```

### Database Query

```sql
SELECT id, status, payment_status, payment_intent_id
FROM orders
WHERE id = 'your-order-id';
```

## ⚠️ Important Notes

### Ngrok Free Plan

- URL thay đổi mỗi lần restart
- Cần cập nhật `.env` và restart service
- Upgrade Pro để có subdomain cố định

### VNPay Sandbox

- Không tốn tiền thật
- Không cần cấu hình IPN URL trên portal
- Test card: `9704198526191432198`

### Production

Khi deploy production:
- Dùng domain thật với HTTPS
- Config nginx reverse proxy
- Đăng ký IPN URL trên VNPay merchant portal
- Setup monitoring và alerts

## 🐛 Troubleshooting

### Ngrok không hoạt động
```bash
ngrok version
ngrok config add-authtoken YOUR_TOKEN
```

### Signature verification failed
- Check `VNPAY_HASH_SECRET` trong `.env`
- Không có space hoặc newline trong secret
- So sánh với VNPay merchant portal

### IPN không được gọi
- Check ngrok web interface: http://127.0.0.1:4040
- Verify `VNPAY_IPN_URL` trong `.env`
- Test ngrok: `curl https://abc123.ngrok.io`

### Order không update
- Check Kafka consumer logs
- Verify topic `payment.result` exists
- Check Order Service đang chạy

## 📞 Support

Nếu gặp vấn đề:

1. Đọc [VNPAY_NGROK_GUIDE.md](./VNPAY_NGROK_GUIDE.md)
2. Check [VNPAY_TESTING_CHECKLIST.md](./VNPAY_TESTING_CHECKLIST.md)
3. Review logs của từng service
4. Check ngrok web interface
5. Verify .env configuration

## 📚 References

- [VNPay API Documentation](https://sandbox.vnpayment.vn/apis/docs/)
- [Ngrok Documentation](https://ngrok.com/docs)
- [Express HTTP Proxy](https://github.com/villadora/express-http-proxy)

## ✅ Success Criteria

Test thành công khi:
- ✅ VNPay gọi IPN về được
- ✅ Signature verification pass
- ✅ Event được publish lên Kafka
- ✅ Order status được update
- ✅ Frontend hiển thị kết quả
- ✅ Không có error trong logs

