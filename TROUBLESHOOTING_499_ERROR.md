# 🚨 HƯỚNG DẪN XỬ LÝ LỖI 499 (CLIENT CLOSED REQUEST)

## 📊 Phân tích log

**Log hiện tại:**
```
/api/stores    499    5s
/api/products  499    3m 18s
/api/stores    499    3m 18s
/api/stores    499    1s
/api/products  499    1s
/api/stores    499    6s
/api/products  499    6s
```

## ❌ LỖI 499 LÀ GÌ?

**Status Code 499** là mã lỗi đặc biệt của **Nginx**, có nghĩa là:
- **"Client Closed Request"** - Client đã ngắt kết nối trước khi server trả về response
- Xảy ra khi request timeout từ phía client (browser)
- Server vẫn đang xử lý nhưng client đã bỏ đi (timeout)

**Điều này khác với:**
- **502 Bad Gateway** - Nginx không kết nối được đến upstream server
- **504 Gateway Timeout** - Upstream server không phản hồi trong thời gian cho phép
- **500 Internal Server Error** - Lỗi xử lý ở backend

## 🔍 NGUYÊN NHÂN

Dựa vào log, có **4 nguyên nhân chính**:

### 1. ❌ Backend Service không kết nối được

**Triệu chứng:**
- Response time rất lâu (3-6 giây)
- Liên tục lỗi 499

**Nguyên nhân:**
- API Gateway không kết nối được đến Product Service hoặc Restaurant Service
- Biến môi trường `PRODUCT_SERVICE_URL` hoặc `RESTAURANT_SERVICE_URL` sai
- Service không khởi động hoặc bị crash

**Cách kiểm tra:**
```bash
# Xem log của API Gateway
# Tìm lỗi kiểu: "Error proxying to product-service: ECONNREFUSED"

# Xem log của Product Service
# Kiểm tra có log "[getAllProducts] Request received" không

# Xem log của Restaurant Service
# Kiểm tra có log "[getAllStores] Request received" không
```

### 2. ❌ Database connection issues

**Triệu chứng:**
- Request đến backend service nhưng không trả về
- Database query timeout

**Nguyên nhân:**
- Backend service không kết nối được database
- `DATABASE_URL` sai hoặc database không khởi động
- Query quá chậm (thiếu index, dữ liệu lớn)

**Cách kiểm tra:**
```bash
# Xem log backend service
# Tìm log: "[getAllProducts] Starting database query..."
# Nếu không có log "Database query completed" → query bị timeout

# Kiểm tra database connection
# Xem biến môi trường DATABASE_URL có đúng không
```

### 3. ❌ Nginx proxy timeout quá ngắn

**Triệu chứng:**
- Request timeout trước khi backend xử lý xong

**Nguyên nhân:**
- Nginx timeout mặc định quá ngắn
- Backend xử lý chậm nhưng vẫn trong giới hạn hợp lý

**Đã sửa:**
- Tăng timeout từ 120s lên 300s (5 phút)
- Thêm retry logic

### 4. ❌ Client timeout (browser)

**Triệu chứng:**
- Browser tự động cancel request sau 1 phút

**Nguyên nhân:**
- Backend quá chậm
- Browser timeout mặc định là 60s

## ✅ GIẢI PHÁP ĐÃ THỰC HIỆN

### 1. **Tăng timeout cho Nginx**

**File:** `frontend/cnpm-fooddelivery/nginx.conf.template`

```nginx
location /api/ {
    proxy_connect_timeout 300s;  # Tăng từ 120s
    proxy_send_timeout 300s;     # Tăng từ 120s
    proxy_read_timeout 300s;     # Tăng từ 120s
}
```

### 2. **Thêm retry logic cho Nginx**

```nginx
proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_tries 2;
proxy_next_upstream_timeout 10s;
```

### 3. **Thêm error handling cho Nginx**

```nginx
error_page 502 503 504 = @api_error;

location @api_error {
    return 503 '{"success": false, "message": "API Gateway is temporarily unavailable"}';
}
```

### 4. **Thêm timeout cho API Gateway proxy**

**File:** `backend/services/api-gateway/src/server.ts`

```typescript
const productServiceProxy = proxy(config.productServiceUrl, {
    timeout: 300000, // 5 minutes
    proxyErrorHandler: function(err, res, next) {
        console.error('[API Gateway] Error:', err.message);
        res.status(503).json({ 
            success: false, 
            message: 'Service temporarily unavailable' 
        });
    }
});
```

### 5. **Thêm logging chi tiết cho backend services**

**File:** `backend/services/product-service/src/controllers/product.ts`
**File:** `backend/services/restaurant-service/src/controllers/store.ts`

```typescript
export const getAllProducts = async (req, res) => {
    const startTime = Date.now();
    console.log('[getAllProducts] Request received at:', new Date().toISOString());
    
    // ... xử lý ...
    
    const dbEndTime = Date.now();
    console.log('[getAllProducts] Database query completed in:', dbEndTime - dbStartTime, 'ms');
    
    const endTime = Date.now();
    console.log('[getAllProducts] Total request time:', endTime - startTime, 'ms');
}
```

## 🧪 CÁCH DEBUG

### **Bước 1: Kiểm tra biến môi trường**

**Railway Dashboard → API Gateway Service → Variables**

Đảm bảo có:
```
PRODUCT_SERVICE_URL=http://product-service.railway.internal:3004
RESTAURANT_SERVICE_URL=http://restaurant-service.railway.internal:3005
```

**Lưu ý:**
- Tên service phải khớp với tên thực tế trên Railway
- Port phải đúng với port service đang lắng nghe

### **Bước 2: Kiểm tra log của từng service**

**1. Frontend (Nginx):**
```
Railway Dashboard → Frontend Service → Deploy Logs
```
Tìm log:
```
GET /api/products - 499
GET /api/stores - 499
```

**2. API Gateway:**
```
Railway Dashboard → API Gateway Service → Deploy Logs
```
Tìm log:
```
[API Gateway] Error proxying to product-service: ECONNREFUSED
[API Gateway] Error proxying to restaurant-service: ECONNREFUSED
```

Nếu có log này → API Gateway không kết nối được đến backend services

**3. Product Service:**
```
Railway Dashboard → Product Service → Deploy Logs
```
Tìm log:
```
[getAllProducts] Request received at: 2025-11-18T00:26:07.000Z
[getAllProducts] Starting database query...
[getAllProducts] Database query completed in: 100 ms
[getAllProducts] Total request time: 150 ms
```

Nếu không có log → Request không đến được Product Service

**4. Restaurant Service:**
```
Railway Dashboard → Restaurant Service → Deploy Logs
```
Tìm log tương tự Product Service

### **Bước 3: Test trực tiếp từng service**

**Test API Gateway:**
```bash
curl https://api-gateway-service-production-04a1.up.railway.app/api/products
```

Nếu:
- ✅ Status 200 → API Gateway hoạt động tốt
- ❌ Status 502 → API Gateway không kết nối được backend
- ❌ Status 504 → Backend timeout
- ❌ Không response → API Gateway không khởi động

**Test Product Service (nếu có public URL):**
```bash
curl https://product-service-xyz.up.railway.app/products
```

### **Bước 4: Kiểm tra database connection**

**Railway Dashboard → Product Service → Variables**

Kiểm tra:
```
DATABASE_URL=postgresql://user:pass@host:port/db?schema=public
```

**Xem log:**
```
PrismaClientInitializationError: Can't reach database server
```

Nếu có lỗi này → Database không kết nối được

## 🔧 CÁC BƯỚC XỬ LÝ THEO THỨ TỰ

### **1. Kiểm tra biến môi trường (quan trọng nhất)**

**API Gateway Service:**
```
PRODUCT_SERVICE_URL=http://product-service.railway.internal:3004
RESTAURANT_SERVICE_URL=http://restaurant-service.railway.internal:3005
USER_SERVICE_URL=http://user-service.railway.internal:1000
ORDER_SERVICE_URL=http://order-service.railway.internal:2000
PAYMENT_SERVICE_URL=http://payment-service.railway.internal:4000
CART_SERVICE_URL=http://cart-service.railway.internal:3006
LOCATION_SERVICE_URL=http://location-service.railway.internal:3007
JWT_SECRET=your-secret-key
```

**Frontend Service:**
```
VITE_API_BASE_URL_INTERNAL=http://api-gateway.railway.internal:3000/api/
```

**Các Backend Services:**
```
DATABASE_URL=postgresql://...
PORT=3004  # hoặc port tương ứng
JWT_SECRET=your-secret-key
```

### **2. Redeploy các service theo thứ tự**

1. Backend Services trước (Product, Restaurant, User, etc.)
2. API Gateway sau
3. Frontend cuối cùng

### **3. Xem log theo thứ tự**

1. Frontend log → Xem có 499 không
2. API Gateway log → Xem có lỗi proxy không
3. Backend Service log → Xem có nhận request không

### **4. Test từng layer**

```bash
# Test backend service trực tiếp (nếu có public URL)
curl https://product-service-xyz.up.railway.app/products

# Test qua API Gateway
curl https://api-gateway-service-production-04a1.up.railway.app/api/products

# Test qua Frontend
curl https://sgucnpmfoodfast-production.up.railway.app/api/products
```

## 📈 KẾT QUẢ MONG ĐỢI SAU KHI SỬA

**Log mới sẽ như thế này:**

```
Nov 18 2025 00:30:00 GET /api/stores    200  100ms
Nov 18 2025 00:30:01 GET /api/products  200  150ms
```

**Backend service logs:**
```
[getAllProducts] Request received at: 2025-11-18T00:30:01.000Z
[getAllProducts] Query params: {}
[getAllProducts] Starting database query...
[getAllProducts] Database query completed in: 50 ms
[getAllProducts] Found 10 products
[getAllProducts] Total request time: 100 ms
```

## 🚨 NẾU VẪN GẶP LỖI 499

### **Trường hợp 1: API Gateway không kết nối được backend**

**Log:**
```
[API Gateway] Error proxying to product-service: ECONNREFUSED
```

**Giải pháp:**
- Kiểm tra tên service trong `PRODUCT_SERVICE_URL` có đúng không
- Vào Railway Dashboard → Product Service → Settings → Networking
- Xem "Private Networking" → Copy đúng tên service
- Update biến môi trường: `PRODUCT_SERVICE_URL=http://{tên-đúng}.railway.internal:3004`

### **Trường hợp 2: Backend không kết nối được database**

**Log:**
```
PrismaClientInitializationError: Can't reach database server
```

**Giải pháp:**
- Kiểm tra `DATABASE_URL` có đúng không
- Đảm bảo database service đã khởi động
- Test connection string

### **Trường hợp 3: Query database quá chậm**

**Log:**
```
[getAllProducts] Starting database query...
(không có log "Database query completed")
```

**Giải pháp:**
- Thêm index cho database
- Tối ưu query (limit số lượng record)
- Kiểm tra database performance

### **Trường hợp 4: Service bị crash**

**Log:**
```
(không có log gì cả)
```

**Giải pháp:**
- Xem Deploy Logs của service
- Tìm lỗi startup (missing env vars, syntax error, etc.)
- Fix lỗi và redeploy

## 📝 CHECKLIST

- [ ] Đã set đúng biến môi trường cho API Gateway
- [ ] Đã set đúng biến môi trường cho Frontend
- [ ] Đã set đúng biến môi trường cho Backend Services
- [ ] Tất cả services đã khởi động thành công
- [ ] API Gateway connect được đến backend services
- [ ] Backend services connect được đến database
- [ ] Test endpoint `/api/products` → Status 200
- [ ] Test endpoint `/api/stores` → Status 200
- [ ] Không còn log 499 trong Frontend
- [ ] Response time < 1s

## 🎯 KẾT LUẬN

Lỗi 499 thường do:
1. **90% trường hợp:** Biến môi trường sai hoặc thiếu
2. **5% trường hợp:** Database connection issues
3. **5% trường hợp:** Service crash hoặc timeout

**Giải pháp chính:**
- ✅ Đã tăng timeout cho Nginx và API Gateway
- ✅ Đã thêm error handling và retry logic
- ✅ Đã thêm logging chi tiết để debug

**Bước tiếp theo:**
1. Set đúng biến môi trường trên Railway
2. Redeploy các service
3. Xem log để kiểm tra
4. Test lại endpoint

Nếu vẫn gặp lỗi, hãy gửi log chi tiết để tôi phân tích thêm!

