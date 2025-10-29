# Hướng dẫn Test VNPay IPN với Ngrok

## Tổng quan

Khi test local, VNPay không thể gọi trực tiếp về `localhost` của bạn. Giải pháp là dùng **ngrok** để tạo một tunnel public, cho phép VNPay gọi IPN callback về máy local.

## Sự khác biệt giữa Return URL và IPN URL

VNPay có 2 loại callback:

### 1. Return URL (`/vnpay_return`)
- **Loại**: Browser redirect (GET request)
- **Khi nào gọi**: Sau khi user hoàn thành thanh toán trên trang VNPay
- **Mục đích**: Redirect user về trang kết quả thanh toán của website
- **Vấn đề**: User có thể không quay về (đóng browser, mất mạng, etc.)

### 2. IPN URL (`/vnpay_ipn`)
- **Loại**: Server-to-server callback (GET request)
- **Khi nào gọi**: Ngay sau khi giao dịch hoàn thành (bất kể user có quay về hay không)
- **Mục đích**: Đảm bảo hệ thống nhận được kết quả thanh toán
- **Độ tin cậy**: Cao hơn Return URL vì không phụ thuộc vào browser của user

**→ Nên implement cả 2, ưu tiên xử lý từ IPN**

## Kiến trúc hiện tại

```
VNPay Server
    ↓ (IPN callback)
    ↓
[Ngrok Tunnel]
    ↓
API Gateway (port 3000)
    ↓ (proxy)
Payment Service (port 3003)
    ↓ (publish event)
Kafka
    ↓ (consume)
Order Service → Cập nhật trạng thái đơn hàng
```

## Flow thanh toán đầy đủ

1. **User tạo đơn hàng** → Order Service tạo order với status `pending`
2. **User chọn thanh toán VNPay** → Payment Service tạo payment URL
3. **User redirect đến VNPay** → User nhập thông tin thanh toán
4. **User hoàn thành thanh toán** → VNPay xử lý giao dịch
5. **VNPay gọi IPN** → `https://abc123.ngrok.io/vnpay_ipn?vnp_ResponseCode=00&...`
   - Ngrok forward → API Gateway → Payment Service
   - Payment Service verify signature
   - Payment Service publish event `payment.result` lên Kafka
   - Order Service consume event và update order status
6. **VNPay redirect user** → `https://abc123.ngrok.io/vnpay_return?vnp_ResponseCode=00&...`
   - API Gateway proxy → Payment Service
   - Payment Service redirect user → Frontend payment result page

## Cài đặt và Cấu hình

### Bước 1: Cài đặt ngrok

```bash
# macOS
brew install ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Windows (với Chocolatey)
choco install ngrok
```

### Bước 2: Đăng ký tài khoản ngrok

1. Truy cập: https://dashboard.ngrok.com/signup
2. Đăng ký tài khoản miễn phí
3. Lấy authtoken: https://dashboard.ngrok.com/get-started/your-authtoken

### Bước 3: Xác thực ngrok

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Sử dụng

### Cách 1: Dùng script có sẵn (Khuyến nghị)

```bash
# Từ thư mục gốc của project
./start-ngrok.sh
```

### Cách 2: Chạy thủ công

```bash
ngrok http 3000
```

### Output mẫu

```
ngrok                                                                    

Session Status                online                                     
Account                       Your Name (Plan: Free)                     
Version                       3.x.x                                      
Region                        Asia Pacific (ap)                          
Web Interface                 http://127.0.0.1:4040                     
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**📝 Copy URL**: `https://abc123.ngrok.io`

### Cập nhật .env

Mở file `backend/services/payment-service/.env`:

```env
# Thay abc123 bằng subdomain của bạn
VNPAY_RETURN_URL=https://abc123.ngrok.io/vnpay_return
VNPAY_IPN_URL=https://abc123.ngrok.io/vnpay_ipn
```

### Restart Payment Service

```bash
cd backend/services/payment-service
# Ctrl+C để stop service hiện tại
pnpm dev
```

## Test và Debug

### 1. Ngrok Web Interface

Mở http://127.0.0.1:4040 trong browser để xem:
- Tất cả requests từ VNPay
- Headers, Query params, Response
- Timeline của các requests

### 2. Log Payment Service

```
VNPAY return callback received: { 
  vnp_ResponseCode: '00',
  vnp_TxnRef: '1234567890',
  vnp_Amount: '10000000',
  vnp_OrderInfo: 'Order abc-123 - Pizza',
  vnp_SecureHash: '...'
}

VNPAY IPN callback received: { ... }

VNPay signature verification: {
  received: 'abc123...',
  calculated: 'abc123...',
  match: true
}

[IPN] Published payment result event for order abc-123: success
```

### 3. Log API Gateway

```
GET /vnpay_return 302
GET /vnpay_ipn 200
```

### 4. Log Order Service

```
Consumed payment result event: {
  orderId: 'abc-123',
  status: 'success',
  paymentIntentId: '1234567890'
}
Order abc-123 updated to status: paid
```

## Xử lý signature verification

### Code đã implement

File `backend/services/payment-service/src/utils/vnpay.ts`:

```typescript
export function verifyVNPaySignature(query: any): boolean {
    const vnp_SecureHash = query.vnp_SecureHash;
    
    // Remove hash fields
    const params = { ...query };
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    // Sort and build sign data
    const sortedKeys = Object.keys(params).sort();
    const signData = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&');

    // Calculate hash
    const signed = crypto
        .createHmac("sha512", VNPAY_HASH_SECRET)
        .update(Buffer.from(signData, "utf-8"))
        .digest("hex");

    return signed === vnp_SecureHash;
}
```

### Response codes từ VNPay

File `backend/services/payment-service/src/server.ts`:

```typescript
// IPN endpoint PHẢI trả về JSON theo format của VNPay
return res.status(200).json({
    RspCode: "00",  // 00 = success
    Message: "success"
});

// Các response codes khác:
// 97 = Invalid signature
// 99 = Unknown error
```

## Lưu ý quan trọng

### 1. URL ngrok thay đổi (bản Free)

- Mỗi lần restart ngrok, URL sẽ khác
- Phải cập nhật lại `.env` và restart Payment Service
- **Giải pháp**: Upgrade ngrok Pro để có custom subdomain cố định

### 2. Không nên dùng cho Production

Ngrok chỉ để test local. Khi deploy production:
- Dùng domain thật
- Config nginx trên VPS/Cloud
- Cấu hình IPN URL trên VNPay merchant portal

### 3. VNPay Sandbox vs Production

**Sandbox (test):**
- Không cần cấu hình IPN URL trên portal
- VNPay tự động gọi IPN từ payment URL

**Production:**
- Phải đăng ký IPN URL trên merchant portal
- URL phải là HTTPS
- URL phải public và stable

### 4. Xác thực HTTPS

VNPay yêu cầu HTTPS cho production. Ngrok free đã cung cấp HTTPS tự động.

## Troubleshooting

### Ngrok không chạy

```bash
# Check version
ngrok version

# Check config
cat ~/.ngrok2/ngrok.yml

# Re-authenticate
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### VNPay không gọi IPN

1. Kiểm tra ngrok web interface: http://127.0.0.1:4040
2. Đảm bảo URL ngrok còn active
3. Check Payment Service logs
4. Verify VNPAY_IPN_URL trong `.env`

### Signature verification failed

1. Check `VNPAY_HASH_SECRET` trong `.env`
2. So sánh với VNPay merchant portal
3. Xem log: `received` vs `calculated` hash
4. Đảm bảo không có space/newline trong secret

### API Gateway không proxy đến Payment Service

1. Check API Gateway logs
2. Verify route config trong `server.ts`
3. Đảm bảo Payment Service đang chạy
4. Check port 3003 (Payment Service)

## Công cụ thay thế

### 1. localtunnel (không cần đăng ký)

```bash
npm install -g localtunnel
lt --port 3000
```

### 2. Tailscale Funnel

```bash
brew install tailscale
tailscale funnel 3000
```

### 3. serveo (SSH tunnel)

```bash
ssh -R 80:localhost:3000 serveo.net
```

### 4. Cloudflare Tunnel (production-ready)

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

## Best Practices

1. **Luôn xác thực signature** trong IPN handler
2. **Log đầy đủ** để debug dễ dàng
3. **Xử lý idempotent**: VNPay có thể gọi IPN nhiều lần
4. **Timeout handling**: Set timeout hợp lý cho Kafka publishing
5. **Error handling**: Trả về response code đúng cho VNPay

## Tài liệu tham khảo

- VNPay API Documentation: https://sandbox.vnpayment.vn/apis/docs/
- Ngrok Documentation: https://ngrok.com/docs
- Express HTTP Proxy: https://github.com/villadora/express-http-proxy

## Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. File log của từng service
2. Ngrok web interface (http://127.0.0.1:4040)
3. Network tab trong browser DevTools
4. Kafka topics (`payment.result`)

