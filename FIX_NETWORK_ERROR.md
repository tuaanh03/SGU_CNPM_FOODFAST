## ✅ ĐÃ SỬA LỖI NETWORK ERROR TRÊN RAILWAY

### Nguyên nhân:
- Frontend bundle không có giá trị `VITE_API_BASE_URL` vì biến này không được truyền vào lúc build
- Nginx proxy chưa config đúng HTTPS cho Railway

### Các thay đổi đã thực hiện:

1. **Dockerfile frontend** (`frontend/cnpm-fooddelivery/Dockerfile`)
   - Thêm `ENV VITE_API_BASE_URL=/api` trước khi build
   - Biến này sẽ được Vite nhúng vào bundle JavaScript

2. **nginx.conf.template** 
   - Sửa `proxy_pass` từ HTTP sang HTTPS
   - Thêm SSL config cho Railway
   - Tăng timeout lên 120s

3. **src/config/api.ts**
   - Đơn giản hóa code
   - Thêm log debug cho development

---

## 🚀 HƯỚNG DẪN DEPLOY RAILWAY

### Bước 1: Cấu hình Environment Variables

#### Service Frontend (`cnpm-fooddelivery`):
```
API_GATEWAY_HOST=<tên-service-api-gateway>.up.railway.app
```

**Cách lấy API_GATEWAY_HOST:**
1. Vào Railway Dashboard
2. Click vào service `api-gateway`
3. Tab Settings → Copy domain (ví dụ: `api-gateway-production-abc.up.railway.app`)
4. Paste vào biến `API_GATEWAY_HOST` của frontend service

**CHÚ Ý:**
- ❌ KHÔNG có `https://`
- ❌ KHÔNG có `/` ở cuối  
- ✅ CHỈ có domain name

#### Service API Gateway:
Kiểm tra có đủ các biến:
```
PORT=3000
USER_SERVICE_URL=http://user-service.railway.internal:1000
ORDER_SERVICE_URL=http://order-service.railway.internal:2000
PAYMENT_SERVICE_URL=http://payment-service.railway.internal:4000
PRODUCT_SERVICE_URL=http://product-service.railway.internal:3004
RESTAURANT_SERVICE_URL=http://restaurant-service.railway.internal:3005
CART_SERVICE_URL=http://cart-service.railway.internal:3006
LOCATION_SERVICE_URL=http://location-service.railway.internal:3007
JWT_SECRET=your-secret-key
```

### Bước 2: Deploy

1. **Push code lên Git:**
```bash
git add .
git commit -m "Fix: Network error - Add VITE_API_BASE_URL to build"
git push
```

2. Railway sẽ tự động deploy lại

3. **HOẶC** Manual deploy trên Railway Dashboard

### Bước 3: Kiểm tra

1. **Xem logs frontend:**
   - Railway → Frontend service → Deployments → View logs
   - Tìm dòng `export API_GATEWAY_HOST=...`
   - Kiểm tra nginx config

2. **Test API Gateway trực tiếp:**
```bash
curl https://<api-gateway-url>/api/products
```

3. **Test Frontend:**
   - Mở `https://<frontend-url>`
   - DevTools → Console → Xem log `API_BASE_URL`
   - DevTools → Network → Xem request `/api/products`

---

## 🐛 DEBUG

Nếu vẫn lỗi, kiểm tra:

### 1. Frontend không gọi đúng URL:
- Mở DevTools → Console
- Tìm log: `🔧 API_BASE_URL: ...`
- Phải là `/api` chứ KHÔNG phải `undefined`

### 2. Nginx không proxy được:
- Railway → Frontend → Shell
```bash
cat /etc/nginx/conf.d/default.conf
# Kiểm tra API_GATEWAY_HOST đã được thay thế đúng chưa

curl https://$API_GATEWAY_HOST/api/products
# Test kết nối từ frontend container tới API Gateway
```

### 3. API Gateway không nhận request:
- Railway → API Gateway → Logs
- Xem có log request từ frontend không
- Kiểm tra CORS config

### 4. CORS Error:
- API Gateway đã config domain Railway trong `allowedOrigins`
- Nếu domain mới, thêm vào `server.ts`:
```typescript
"https://your-new-domain.up.railway.app"
```

---

## 📝 Notes

- Railway dùng HTTPS cho tất cả public URLs
- Internal network giữa các service dùng HTTP
- Biến môi trường mất 1-2 phút để apply sau khi thay đổi
- Mỗi lần sửa env var phải redeploy service

