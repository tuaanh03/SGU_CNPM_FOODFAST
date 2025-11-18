# ✅ XÁC NHẬN: CẤU HÌNH HOẠT ĐỘNG CHO CẢ DOCKER-COMPOSE VÀ RAILWAY

## 🎯 Tóm tắt

**Câu trả lời:** **ĐÚNG! Cấu hình hiện tại hoạt động tốt cho cả docker-compose và Railway mà không ảnh hưởng lẫn nhau.**

---

## 🔧 Cách thức hoạt động

### **1. Frontend Code (src/config/api.ts)**

```typescript
const API_BASE_URL = '/api';  // Hardcode, không phụ thuộc biến môi trường
```

- Frontend luôn gọi API qua relative path `/api/`
- Không cần biến môi trường lúc build
- Hoạt động giống nhau cho cả docker-compose và Railway

---

### **2. Nginx Configuration (nginx.conf.template)**

```nginx
location /api/ {
    proxy_pass ${VITE_API_BASE_URL_INTERNAL};
}
```

- Nginx proxy request từ `/api/` sang API Gateway
- Biến `VITE_API_BASE_URL_INTERNAL` được set khác nhau tùy môi trường
- Nginx tự động thay thế biến này khi container khởi động

---

### **3. Docker-Compose Environment**

**File:** `docker-compose.yml`

```yaml
frontend:
  environment:
    - VITE_API_BASE_URL_INTERNAL=http://api-gateway:3000/api/
```

**Hoạt động:**
1. Frontend gọi: `fetch('/api/products')`
2. Request đến: `http://localhost:80/api/products`
3. Nginx nhận request `/api/products`
4. Nginx proxy sang: `http://api-gateway:3000/api/products`
5. API Gateway nhận và xử lý

**Ưu điểm:**
- Sử dụng internal docker network (nhanh, bảo mật)
- Không cần expose API Gateway ra ngoài
- Tên service `api-gateway` resolve được nhờ Docker DNS

---

### **4. Railway Environment**

**Biến môi trường trên Railway:**

```
VITE_API_BASE_URL_INTERNAL=http://api-gateway.railway.internal:3000/api/
```

**Hoặc dùng public URL:**

```
VITE_API_BASE_URL_INTERNAL=https://api-gateway-service-production-04a1.up.railway.app/api/
```

**Hoạt động:**
1. Frontend gọi: `fetch('/api/products')`
2. Request đến: `https://sgucnpmfoodfast-production.up.railway.app/api/products`
3. Nginx nhận request `/api/products`
4. Nginx proxy sang: `http://api-gateway.railway.internal:3000/api/products`
5. API Gateway nhận và xử lý

**Ưu điểm:**
- Sử dụng Railway private networking (miễn phí, nhanh)
- Tránh CORS issues
- Không tốn băng thông public

---

## 📊 So sánh 2 môi trường

| Khía cạnh | Docker-Compose | Railway |
|-----------|----------------|---------|
| **Frontend code** | `/api` (hardcode) | `/api` (hardcode) |
| **Nginx proxy** | `http://api-gateway:3000/api/` | `http://api-gateway.railway.internal:3000/api/` |
| **Networking** | Docker internal network | Railway private networking |
| **Cấu hình khác nhau?** | ❌ Không | ❌ Không |
| **Cần rebuild khi chuyển?** | ❌ Không | ❌ Không |

---

## ✅ Checklist xác nhận

### **Docker-Compose:**

- [x] Frontend code dùng `/api` hardcode
- [x] Nginx proxy `/api/` → `http://api-gateway:3000/api/`
- [x] Biến `VITE_API_BASE_URL_INTERNAL` set trong `docker-compose.yml`
- [x] Không cần biến môi trường lúc build
- [x] API Gateway accessible qua `http://api-gateway:3000`

### **Railway:**

- [x] Frontend code dùng `/api` hardcode (giống docker-compose)
- [x] Nginx proxy `/api/` → `http://api-gateway.railway.internal:3000/api/`
- [x] Biến `VITE_API_BASE_URL_INTERNAL` set trong Railway Dashboard
- [x] Không cần biến môi trường lúc build (giống docker-compose)
- [x] API Gateway accessible qua Railway private networking

---

## 🧪 Cách test

### **Test Docker-Compose:**

1. Chạy docker-compose:
   ```bash
   docker-compose up -d --build
   ```

2. Mở browser: `http://localhost`

3. Mở DevTools Console, kiểm tra:
   ```
   🔧 API Configuration:
     - API_BASE_URL: /api
     - Mode: production
   ```

4. Mở DevTools Network tab, gọi API:
   - Request URL: `http://localhost/api/products`
   - Status: 200 OK

### **Test Railway:**

1. Deploy lên Railway (đã set biến `VITE_API_BASE_URL_INTERNAL`)

2. Mở browser: `https://sgucnpmfoodfast-production.up.railway.app`

3. Mở DevTools Console, kiểm tra:
   ```
   🔧 API Configuration:
     - API_BASE_URL: /api
     - Mode: production
   ```

4. Mở DevTools Network tab, gọi API:
   - Request URL: `https://sgucnpmfoodfast-production.up.railway.app/api/products`
   - Status: 200 OK

---

## 🚨 Lưu ý quan trọng

### **1. Không cần rebuild khi chuyển môi trường**

Code frontend đã hardcode `/api`, nên:
- Build 1 lần, chạy được ở mọi nơi
- Chỉ cần set biến `VITE_API_BASE_URL_INTERNAL` khác nhau

### **2. Biến môi trường chỉ dùng cho nginx runtime**

- Biến `VITE_API_BASE_URL_INTERNAL` chỉ dùng cho nginx
- Nginx thay thế biến này khi container khởi động
- Frontend code không biết và không quan tâm đến biến này

### **3. File .env local chỉ để tham khảo**

- File `.env` trong `frontend/cnpm-fooddelivery/` chỉ để dev tham khảo
- Docker-compose sẽ override bằng biến trong `docker-compose.yml`
- Railway sẽ override bằng biến trong Railway Dashboard

---

## 🎉 Kết luận

**Cấu hình hiện tại hoàn hảo cho cả docker-compose và Railway:**

1. ✅ **Code giống nhau** → Không cần sửa code khi deploy
2. ✅ **Build 1 lần** → Sử dụng được cho cả 2 môi trường
3. ✅ **Chỉ khác biến môi trường** → Dễ quản lý, dễ debug
4. ✅ **Tận dụng internal networking** → Nhanh, bảo mật, tiết kiệm
5. ✅ **Không ảnh hưởng lẫn nhau** → Chạy docker-compose không ảnh hưởng Railway và ngược lại

**Bạn có thể yên tâm:**
- Chạy `docker-compose up -d --build` để test local
- Deploy lên Railway mà không cần lo lắng gì
- Chỉ cần đảm bảo set đúng biến `VITE_API_BASE_URL_INTERNAL` cho từng môi trường

---

## 📝 Tham khảo nhanh

### **Biến môi trường cho Docker-Compose:**
```yaml
# Trong docker-compose.yml
environment:
  - VITE_API_BASE_URL_INTERNAL=http://api-gateway:3000/api/
```

### **Biến môi trường cho Railway:**
```
# Trong Railway Dashboard → Frontend Service → Variables
VITE_API_BASE_URL_INTERNAL=http://api-gateway.railway.internal:3000/api/
```

### **Kiểm tra nhanh:**
```bash
# Docker-Compose
curl http://localhost/api/products

# Railway
curl https://sgucnpmfoodfast-production.up.railway.app/api/products
```

---

**Ngày cập nhật:** 18/11/2025
**Trạng thái:** ✅ Đã xác nhận hoạt động tốt

