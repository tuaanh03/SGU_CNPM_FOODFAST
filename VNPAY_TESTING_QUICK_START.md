# Quick Start Guide: Testing VNPay with ngrok

## Bước 1: Cài đặt và setup ngrok

```bash
# Cài ngrok
brew install ngrok

# Đăng ký tài khoản miễn phí: https://dashboard.ngrok.com/signup
# Lấy authtoken: https://dashboard.ngrok.com/get-started/your-authtoken

# Xác thực ngrok
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Bước 2: Start các services

### Terminal 1 - API Gateway
```bash
cd backend/services/api-gateway
pnpm install
pnpm dev
```

### Terminal 2 - Payment Service
```bash
cd backend/services/payment-service
pnpm install
pnpm dev
```

### Terminal 3 - Các services khác (order, product, etc.)
```bash
# Hoặc dùng docker-compose nếu có
docker-compose up
```

## Bước 3: Start ngrok

### Terminal 4 - Ngrok
```bash
# Từ thư mục gốc của project
./start-ngrok.sh

# Hoặc chạy trực tiếp
ngrok http 3000
```

Bạn sẽ thấy output như sau:
```
ngrok                                                                    

Session Status                online                                     
Account                       Your Name (Plan: Free)                     
Version                       3.x.x                                      
Region                        Asia Pacific (ap)                          
Latency                       -                                          
Web Interface                 http://127.0.0.1:4040                     
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**📝 Copy URL ngrok**: `https://abc123.ngrok.io`

## Bước 4: Cập nhật .env của Payment Service

Mở file `backend/services/payment-service/.env` và cập nhật:

```env
# Thay abc123 bằng subdomain của bạn
VNPAY_RETURN_URL=https://abc123.ngrok.io/vnpay_return
VNPAY_IPN_URL=https://abc123.ngrok.io/vnpay_ipn
```

## Bước 5: Restart Payment Service

Quay lại Terminal 2 (Payment Service):
- Nhấn `Ctrl+C` để stop
- Chạy lại `pnpm dev`

## Bước 6: Test thanh toán

1. Truy cập frontend: http://localhost:5173
2. Thêm sản phẩm vào giỏ hàng
3. Tiến hành thanh toán
4. Chọn VNPay làm phương thức thanh toán
5. Hoàn thành thanh toán trên trang VNPay sandbox

## Bước 7: Kiểm tra logs

### Ngrok Web Interface
Mở http://127.0.0.1:4040 để xem tất cả requests từ VNPay:
- Bạn sẽ thấy cả `GET /vnpay_return` và `GET /vnpay_ipn`
- Xem chi tiết headers, query params, response

### Payment Service logs
```
VNPAY return callback received: { vnp_ResponseCode: '00', ... }
VNPAY IPN callback received: { vnp_ResponseCode: '00', ... }
VNPay signature verification: { received: '...', calculated: '...', match: true }
[IPN] Published payment result event for order xxx: success
```

### API Gateway logs
```
GET /vnpay_return 302
GET /vnpay_ipn 200
```

## Lưu ý quan trọng

### 1. URL ngrok thay đổi mỗi lần restart (bản free)
- Mỗi lần chạy `ngrok http 3000`, bạn sẽ nhận URL mới
- Cần cập nhật lại `.env` và restart Payment Service
- **Giải pháp**: Upgrade lên ngrok Pro để có subdomain cố định

### 2. Hai loại callback từ VNPay

| Callback | Loại | URL | Mục đích |
|----------|------|-----|----------|
| Return URL | Browser redirect | `/vnpay_return` | Redirect user về frontend sau khi thanh toán |
| IPN URL | Server-to-server | `/vnpay_ipn` | VNPay gọi để xác nhận giao dịch |

- **Return URL**: User có thể không quay về (đóng browser, mất mạng)
- **IPN URL**: Đảm bảo hệ thống nhận được kết quả thanh toán
- → Nên xử lý cả 2 URL, ưu tiên tin IPN

### 3. Xác thực chữ ký
Code đã implement xác thực `vnp_SecureHash` để đảm bảo request thật sự từ VNPay, không phải giả mạo.

### 4. Test với VNPay Sandbox
- Không cần cấu hình IPN URL trên portal VNPay khi dùng sandbox
- VNPay sandbox tự động gọi IPN URL (nếu có trong request)
- Production thì cần cấu hình IPN URL trên merchant portal

## Troubleshooting

### Ngrok không hoạt động
```bash
# Kiểm tra ngrok version
ngrok version

# Kiểm tra config
cat ~/.ngrok2/ngrok.yml

# Re-authenticate
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### VNPay không gọi IPN
- Kiểm tra log ngrok web interface: http://127.0.0.1:4040
- Đảm bảo URL ngrok còn active (không expire)
- Xem log Payment Service để check signature verification

### Signature verification failed
- Kiểm tra `VNPAY_HASH_SECRET` trong `.env` đúng chưa
- So sánh với thông tin trên VNPay merchant portal
- Check log để xem `received` vs `calculated` hash

## Công cụ thay thế ngrok

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

