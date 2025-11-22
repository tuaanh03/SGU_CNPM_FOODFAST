# Hướng dẫn cấu hình nhận IPN từ VNPay khi test local

## Vấn đề
Khi test trên local (localhost), VNPay không thể gọi callback IPN về máy bạn vì localhost không public trên internet.

## Giải pháp: Dùng ngrok

### Bước 1: Cài đặt ngrok

```bash
# Trên macOS
brew install ngrok

# Hoặc download từ: https://ngrok.com/download
```

### Bước 2: Đăng ký tài khoản ngrok (miễn phí)
- Truy cập: https://dashboard.ngrok.com/signup
- Lấy authtoken tại: https://dashboard.ngrok.com/get-started/your-authtoken

### Bước 3: Xác thực ngrok

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Bước 4: Start API Gateway (port 3000)

```bash
cd backend/services/api-gateway
pnpm install
pnpm dev
```

### Bước 5: Expose API Gateway qua ngrok

Mở terminal mới và chạy:

```bash
ngrok http 3000
```

Bạn sẽ nhận được output như sau:

```
Forwarding     https://abc123.ngrok.io -> http://localhost:3000
```

### Bước 6: Cập nhật URL trong VNPay config

Sao chép URL ngrok (ví dụ: `https://abc123.ngrok.io`) và cập nhật vào file `.env` của payment-service:

```env
# backend/services/payment-service/.env
VNPAY_RETURN_URL=https://abc123.ngrok.io/vnpay_return
```

**Lưu ý**: Mỗi lần chạy ngrok, URL sẽ thay đổi (với bản free). Bạn cần cập nhật lại URL này.

### Bước 7: Restart Payment Service

```bash
cd backend/services/payment-service
pnpm dev
```

## Cách test

1. Tạo một đơn hàng và thanh toán qua VNPay
2. VNPay sẽ redirect về URL: `https://abc123.ngrok.io/vnpay_return?...`
3. Ngrok sẽ forward request này về `http://localhost:3000/vnpay_return`
4. API Gateway sẽ proxy về Payment Service
5. Payment Service xử lý callback và publish event lên Kafka

## Kiểm tra log

### Trên terminal chạy ngrok:
Bạn sẽ thấy request từ VNPay:
```
HTTP Requests
-------------
GET /vnpay_return    200 OK
```

### Trên console API Gateway:
```
GET /vnpay_return 200
```

### Trên console Payment Service:
```
VNPAY callback received: { vnp_ResponseCode: '00', ... }
Published payment result event for order xxx: success
```

## Giải pháp thay thế: LocalTunnel (không cần đăng ký)

```bash
# Cài đặt
npm install -g localtunnel

# Chạy
lt --port 3000
```

## Giải pháp khác: Tailscale Funnel (nâng cao)

Nếu bạn muốn URL cố định và bảo mật hơn, có thể dùng Tailscale Funnel:
- https://tailscale.com/kb/1223/funnel

## Lưu ý quan trọng

1. **Mỗi lần restart ngrok** (bản free), URL sẽ thay đổi → phải cập nhật lại VNPAY_RETURN_URL
2. **Ngrok paid**: Có thể dùng custom subdomain cố định
3. **Chỉ dùng cho test**: Không nên dùng ngrok cho production

## Nếu muốn dùng nginx (cho môi trường staging)

Khi bạn có server public (VPS), có thể config nginx như sau:

```nginx
# /etc/nginx/sites-available/vnpay-webhook

server {
    listen 80;
    server_name your-domain.com;

    location /vnpay_return {
        proxy_pass http://localhost:3000/vnpay_return;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Nhưng điều này yêu cầu:
- Có server public với IP tĩnh hoặc domain
- Đã setup nginx trên server
- VNPay có thể gọi tới domain/IP của bạn

**→ Không phù hợp khi test local, chỉ dùng khi deploy lên server thật.**

