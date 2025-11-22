# 🚂 HƯỚNG DẪN CẤU HÌNH BIẾN MÔI TRƯỜNG TRÊN RAILWAY

## 📋 Tổng quan

Hệ thống microservices của bạn gồm các service sau:
- **Frontend:** cnpm-fooddelivery
- **API Gateway:** api-gateway
- **Backend Services:** product-service, restaurant-service, user-service, order-service, payment-service, cart-service, location-service

## 🔧 CẤU HÌNH CHO TỪNG SERVICE

### 1. Frontend Service (cnpm-fooddelivery)

**Biến môi trường cần thiết:**

```env
# URL để nginx proxy request từ /api/ sang API Gateway
# Sử dụng private networking (khuyến nghị):
VITE_API_BASE_URL_INTERNAL=http://api-gateway.railway.internal:3000/api/

# Hoặc sử dụng public URL (nếu cần):
# VITE_API_BASE_URL_INTERNAL=https://api-gateway-service-production-04a1.up.railway.app/api/

# Mapbox token (nếu có)
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoibmdvdHVhbmFuaCIsImEiOiJjbWdtaTQ3dXYwdGh2Mm9wcWwxd3g3dGV1In0.7_DXCJmqmBNQQuXSF5w3Ow
```

**LƯU Ý:**
- Biến `VITE_API_BASE_URL_INTERNAL` được nginx sử dụng khi khởi động container
- Frontend code đã hardcode `/api`, không cần biến môi trường cho build
- Đảm bảo có dấu `/` ở cuối URL

---

### 2. API Gateway Service

**Biến môi trường cần thiết:**

```env
# Port (Railway tự động set, không cần config thủ công)
PORT=3000

# JWT Secret cho authentication
JWT_SECRET=your-jwt-secret-key-here

# URLs của các backend services (sử dụng private networking)
PRODUCT_SERVICE_URL=http://product-service.railway.internal:3004
RESTAURANT_SERVICE_URL=http://restaurant-service.railway.internal:3005
USER_SERVICE_URL=http://user-service.railway.internal:1000
ORDER_SERVICE_URL=http://order-service.railway.internal:2000
PAYMENT_SERVICE_URL=http://payment-service.railway.internal:4000
CART_SERVICE_URL=http://cart-service.railway.internal:3006
LOCATION_SERVICE_URL=http://location-service.railway.internal:3007
```

**LƯU Ý:**
- Tên service trong URL phải khớp với tên service trên Railway Dashboard
- Format: `http://{service-name}.railway.internal:{port}`
- KHÔNG có dấu `/` ở cuối
- KHÔNG có `/api` trong URL (API Gateway sẽ tự xử lý)

**Cách kiểm tra tên service:**
1. Vào Railway Dashboard
2. Mở service bạn muốn kiểm tra
3. Vào tab "Settings" → "Networking"
4. Xem phần "Private Networking" → Tên service sẽ hiển thị ở đó

---

### 3. Product Service

**Biến môi trường cần thiết:**

```env
# Port
PORT=3004

# Database
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# Kafka
KAFKA_BROKERS=kafka:9092

# JWT Secret (nếu service cần verify token)
JWT_SECRET=your-jwt-secret-key-here
```

---

### 4. Restaurant Service

**Biến môi trường cần thiết:**

```env
# Port
PORT=3005

# Database
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# JWT Secret
JWT_SECRET=your-jwt-secret-key-here
```

---

### 5. User Service

**Biến môi trường cần thiết:**

```env
# Port
PORT=1000

# Database
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# JWT Secret
JWT_SECRET=your-jwt-secret-key-here
```

---

### 6. Order Service

**Biến môi trường cần thiết:**

```env
# Port
PORT=2000

# Database
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# Kafka
KAFKA_BROKERS=kafka:9092

# JWT Secret
JWT_SECRET=your-jwt-secret-key-here
```

---

### 7. Payment Service

**Biến môi trường cần thiết:**

```env
# Port
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# VNPay Configuration
VNPAY_TMN_CODE=your-vnpay-tmn-code
VNPAY_HASH_SECRET=your-vnpay-hash-secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://sgucnpmfoodfast-production.up.railway.app/payment-result

# JWT Secret
JWT_SECRET=your-jwt-secret-key-here
```

---

### 8. Cart Service

**Biến môi trường cần thiết:**

```env
# Port
PORT=3006

# Database
DATABASE_URL=postgresql://user:password@host:port/database?schema=public

# JWT Secret
JWT_SECRET=your-jwt-secret-key-here
```

---

### 9. Location Service

**Biến môi trường cần thiết:**

```env
# Port
PORT=3007

# Database
DATABASE_URL=postgresql://user:password@host:port/database?schema=public
```

---

## 🔍 CÁCH KIỂM TRA CẤU HÌNH

### 1. Kiểm tra Frontend gọi đến API Gateway

Mở DevTools Console và xem request:
```
Request URL: https://sgucnpmfoodfast-production.up.railway.app/api/products
```

Nếu đúng:
- Status: 200 OK
- Response có dữ liệu products

Nếu sai:
- Status: 404 → Kiểm tra nginx proxy
- Status: 502 → Kiểm tra API Gateway có khởi động không
- Status: 500 → Kiểm tra API Gateway có kết nối được đến Product Service không

### 2. Kiểm tra API Gateway kết nối đến Backend Services

Vào Railway Dashboard → API Gateway Service → Deploy Logs

Tìm log kiểu:
```
API Gateway is running on port 3000
```

Nếu có lỗi kết nối đến backend services, sẽ có log lỗi.

### 3. Kiểm tra Backend Service có khởi động không

Vào Railway Dashboard → Product Service → Deploy Logs

Tìm log kiểu:
```
Product service is running on port 3004
```

### 4. Test trực tiếp API Gateway

Mở browser hoặc Postman, gọi:
```
https://api-gateway-service-production-04a1.up.railway.app/api/products
```

Nếu trả về 200 OK → API Gateway hoạt động tốt
Nếu trả về 404 → Kiểm tra routing trong API Gateway
Nếu trả về 502 → Kiểm tra Product Service có khởi động không

---

## 🚨 TROUBLESHOOTING

### Lỗi 404 Not Found khi gọi `/api/products`

**Nguyên nhân:**
1. Nginx không proxy đúng đến API Gateway
2. API Gateway không route đến Product Service
3. Product Service không có route `/products`

**Giải pháp:**
1. Kiểm tra biến `VITE_API_BASE_URL_INTERNAL` trong Frontend Service
2. Kiểm tra biến `PRODUCT_SERVICE_URL` trong API Gateway Service
3. Kiểm tra Product Service có khởi động không

### Lỗi 502 Bad Gateway

**Nguyên nhân:**
1. API Gateway không kết nối được đến Product Service
2. Product Service không khởi động
3. URL không đúng (sai port, sai tên service)

**Giải pháp:**
1. Kiểm tra lại tên service trong Railway Dashboard
2. Kiểm tra port có đúng không
3. Kiểm tra Product Service có khởi động không
4. Kiểm tra private networking đã được enable chưa

### Lỗi CORS

**Nguyên nhân:**
1. API Gateway không có CORS config cho origin của frontend
2. Nginx không forward header đúng

**Giải pháp:**
1. Kiểm tra CORS config trong API Gateway (`server.ts`)
2. Đảm bảo origin `https://sgucnpmfoodfast-production.up.railway.app` đã được thêm vào allowedOrigins

---

## 📝 CHECKLIST SAU KHI CẤU HÌNH

- [ ] Frontend Service: Set biến `VITE_API_BASE_URL_INTERNAL`
- [ ] API Gateway Service: Set tất cả các biến `*_SERVICE_URL`
- [ ] Tất cả Backend Services: Set biến `DATABASE_URL`, `PORT`, `JWT_SECRET`
- [ ] Test frontend gọi `/api/products` → Status 200
- [ ] Test frontend gọi `/api/stores` → Status 200
- [ ] Kiểm tra Console không có lỗi CORS
- [ ] Kiểm tra Network tab: Request URL đúng format

---

## 🎯 KẾT LUẬN

Sau khi cấu hình đúng các biến môi trường, hệ thống sẽ hoạt động như sau:

1. **Frontend gọi API:**
   - `axios.get('/api/products')`
   - → `https://sgucnpmfoodfast-production.up.railway.app/api/products`

2. **Nginx proxy:**
   - Nhận request `/api/products`
   - Proxy đến `${VITE_API_BASE_URL_INTERNAL}products`
   - = `https://api-gateway-service-production-04a1.up.railway.app/api/products`

3. **API Gateway xử lý:**
   - Nhận request `/api/products`
   - Route đến `productServiceProxy`
   - Proxy đến `${PRODUCT_SERVICE_URL}/products`
   - = `http://product-service.railway.internal:3004/products`

4. **Product Service xử lý:**
   - Nhận request `/products`
   - Trả về danh sách products

5. **Response trả về:**
   - Product Service → API Gateway → Nginx → Frontend
   - Frontend nhận data và hiển thị

