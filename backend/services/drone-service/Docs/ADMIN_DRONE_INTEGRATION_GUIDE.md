# 🚁 Admin Dashboard - Drone Management Integration Guide

## 📋 Tổng quan

Tài liệu này hướng dẫn cách admin-dashboard tích hợp với drone-service thông qua API Gateway để quản lý drone.

---

## 🏗️ Kiến trúc

```
Admin Dashboard (Frontend)
    ↓ HTTP Request
API Gateway (Port 3000)
    ↓ Proxy với Authentication
Drone Service (Port 3008)
    ↓ Database
PostgreSQL (drone-db)
```

---

## 🔧 Các thay đổi đã thực hiện

### 1. **Backend - API Gateway**

#### **File: `backend/services/api-gateway/src/config/index.ts`**
```typescript
// Đã thêm
droneServiceUrl: process.env.DRONE_SERVICE_URL || "http://drone-service:3008"
```

#### **File: `backend/services/api-gateway/src/server.ts`**
```typescript
// 1. Tạo proxy middleware
const droneServiceProxy = proxy(config.droneServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('drone-service', { forwardUser: true })
});

// 2. Đăng ký routes với authentication
server.use("/api/drones", authenticateToken, droneServiceProxy);
server.use("/api/deliveries", authenticateToken, droneServiceProxy);
```

**Logic:**
- Tất cả requests đến `/api/drones/*` và `/api/deliveries/*` đều cần token
- API Gateway xác thực token và forward user info (userId, email, role) đến drone-service
- Metrics được track cho monitoring

---

### 2. **Frontend - Admin Dashboard**

#### **File mới: `frontend/admin-dashboard/src/services/drone.service.ts`**

Service này cung cấp tất cả methods để gọi API:

**Drone Management:**
- `getAllDrones(status?)` - Lấy tất cả drones (có filter theo status)
- `getAvailableDrones()` - Lấy drones khả dụng
- `getDroneById(id)` - Lấy chi tiết drone
- `createDrone(data)` - Tạo drone mới
- `updateDrone(id, data)` - Cập nhật drone
- `updateDroneLocation(id, data)` - Cập nhật vị trí drone
- `deleteDrone(id)` - Xóa drone

**Delivery Management:**
- `getAllDeliveries(filters?)` - Lấy tất cả deliveries
- `getDeliveryById(id)` - Lấy chi tiết delivery
- `getDeliveryByOrderId(orderId)` - Lấy delivery theo orderId
- `createDelivery(data)` - Tạo delivery mới
- `updateDeliveryStatus(id, status)` - Cập nhật trạng thái
- `addTrackingPoint(deliveryId, data)` - Thêm tracking point

**Authentication:**
```typescript
private getAuthHeader() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}
```

---

#### **File mới: `frontend/admin-dashboard/src/pages/DroneManagementPage.tsx`**

UI Component cho quản lý drone với features:
- ✅ Hiển thị danh sách drones dạng grid
- ✅ Tạo drone mới (Dialog)
- ✅ Cập nhật drone (Dialog)
- ✅ Xóa drone (với confirmation)
- ✅ Hiển thị status với màu sắc (Badge)
- ✅ Hiển thị pin với progress bar
- ✅ Hiển thị vị trí GPS

**Các trạng thái drone:**
- `AVAILABLE` - Sẵn sàng (màu xanh)
- `IN_USE` - Đang giao (màu xanh dương)
- `CHARGING` - Đang sạc (màu vàng)
- `MAINTENANCE` - Bảo trì (màu cam)
- `OFFLINE` - Offline (màu xám)

---

#### **File đã sửa: `frontend/admin-dashboard/src/App.tsx`**

```typescript
// Import
import DroneManagementPage from "./pages/DroneManagementPage";

// Route mới
<Route
  path="/drones"
  element={
    <ProtectedRoute requiredRole="SYSTEM_ADMIN">
      <DroneManagementPage />
    </ProtectedRoute>
  }
/>
```

---

#### **File đã sửa: `frontend/admin-dashboard/src/pages/DashboardPage.tsx`**

```typescript
// Card "Quản Lý Drone" giờ navigate đến /drones
<Card onClick={() => navigate("/drones")}>
  <Button>Xem Drone</Button>
</Card>
```

---

## 🚀 API Endpoints (qua API Gateway)

### **Base URL:** `http://localhost:3000/api`

### **Authentication Required:** ✅ Tất cả endpoints cần Bearer token

### **1. Drone Management**

#### **GET /api/drones**
Lấy tất cả drones
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/drones
```

Query params:
- `status` - Filter theo status (AVAILABLE, IN_USE, CHARGING, MAINTENANCE, OFFLINE)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Drone Alpha",
      "model": "DJI Mavic 3",
      "serialNumber": "DJI-001",
      "battery": 95,
      "status": "AVAILABLE",
      "maxPayload": 5.0,
      "maxRange": 20.0,
      "currentLat": 10.762622,
      "currentLng": 106.660172
    }
  ]
}
```

#### **GET /api/drones/available**
Lấy drones khả dụng
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/drones/available
```

#### **GET /api/drones/:id**
Lấy chi tiết drone
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/drones/{droneId}
```

#### **POST /api/drones**
Tạo drone mới
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Drone Beta",
    "model": "DJI Mavic 3",
    "serialNumber": "DJI-002",
    "maxPayload": 5.0,
    "maxRange": 20.0
  }' \
  http://localhost:3000/api/drones
```

#### **PUT /api/drones/:id**
Cập nhật drone
```bash
curl -X PUT \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Drone Beta Updated",
    "battery": 90,
    "status": "CHARGING"
  }' \
  http://localhost:3000/api/drones/{droneId}
```

#### **PATCH /api/drones/:id/location**
Cập nhật vị trí drone
```bash
curl -X PATCH \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "currentLat": 10.765000,
    "currentLng": 106.665000,
    "battery": 85
  }' \
  http://localhost:3000/api/drones/{droneId}/location
```

#### **DELETE /api/drones/:id**
Xóa drone
```bash
curl -X DELETE \
  -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/drones/{droneId}
```

---

### **2. Delivery Management**

#### **GET /api/deliveries**
Lấy tất cả deliveries
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/deliveries
```

Query params:
- `status` - Filter theo status
- `droneId` - Filter theo droneId

#### **GET /api/deliveries/:id**
Lấy chi tiết delivery
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/deliveries/{deliveryId}
```

#### **GET /api/deliveries/order/:orderId**
Lấy delivery theo orderId
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/deliveries/order/{orderId}
```

#### **POST /api/deliveries**
Tạo delivery mới
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-123",
    "droneId": "{droneId}",
    "restaurantName": "Phở 24",
    "restaurantLat": 10.762622,
    "restaurantLng": 106.660172,
    "restaurantAddress": "123 Nguyen Hue",
    "customerName": "Nguyen Van A",
    "customerPhone": "0901234567",
    "customerLat": 10.772622,
    "customerLng": 106.670172,
    "customerAddress": "456 Le Loi",
    "distance": 1.5,
    "estimatedTime": 10
  }' \
  http://localhost:3000/api/deliveries
```

#### **PATCH /api/deliveries/:id/status**
Cập nhật delivery status
```bash
curl -X PATCH \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_TRANSIT"}' \
  http://localhost:3000/api/deliveries/{deliveryId}/status
```

Status flow:
```
PENDING → ASSIGNED → PICKING_UP → IN_TRANSIT → DELIVERED
```

#### **POST /api/deliveries/:deliveryId/tracking**
Thêm tracking point
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 10.765000,
    "lng": 106.665000,
    "altitude": 50,
    "speed": 15,
    "battery": 85
  }' \
  http://localhost:3000/api/deliveries/{deliveryId}/tracking
```

---

## 🧪 Testing

### **1. Start Services**

```bash
# Start tất cả services với docker-compose
docker-compose up -d

# Hoặc chỉ start các services cần thiết
docker-compose up -d api-gateway drone-service drone-db
```

### **2. Login Admin**

```bash
# Login để lấy token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'

# Response
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "...",
    "role": "SYSTEM_ADMIN"
  }
}
```

### **3. Test Drone API**

```bash
# Set token
TOKEN="your-token-here"

# Test create drone
curl -X POST http://localhost:3000/api/drones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Drone",
    "model": "DJI Mavic 3",
    "serialNumber": "TEST-001",
    "maxPayload": 5.0,
    "maxRange": 20.0
  }'

# Test get all drones
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/drones
```

### **4. Test Frontend**

```bash
# Start admin-dashboard
cd frontend/admin-dashboard
npm run dev

# Truy cập
# http://localhost:8081 (hoặc port trong vite config)

# Login với SYSTEM_ADMIN account
# Navigate: Dashboard → Quản Lý Drone
```

---

## 🔒 Security

### **Authentication Flow:**
```
1. Admin login → Nhận JWT token
2. Frontend lưu token vào localStorage
3. Mỗi API call gửi token trong header: Authorization: Bearer {token}
4. API Gateway verify token
5. API Gateway forward user info (userId, email, role) đến drone-service
6. Drone-service có thể dùng user info để audit/logging
```

### **Authorization:**
- ✅ Chỉ `SYSTEM_ADMIN` mới được truy cập admin-dashboard
- ✅ Protected routes check role trong `ProtectedRoute` component
- ✅ API Gateway verify token trước khi proxy

---

## 📊 Monitoring

API Gateway tự động track metrics cho drone-service:
- `proxy_requests_total{service="drone-service"}` - Tổng requests
- `proxy_duration_seconds{service="drone-service"}` - Latency
- `proxy_errors_total{service="drone-service"}` - Errors

Xem metrics tại: `http://localhost:3000/metrics`

---

## 🐛 Troubleshooting

### **Lỗi: 401 Unauthorized**
```
Nguyên nhân: Token không hợp lệ hoặc expired
Giải pháp: Login lại để lấy token mới
```

### **Lỗi: 404 Not Found**
```
Nguyên nhân: 
- Drone-service chưa chạy
- Route không đúng
Giải pháp:
- Check drone-service: docker logs drone-service
- Verify route: /api/drones (không phải /drones)
```

### **Lỗi: CORS**
```
Nguyên nhân: Frontend URL chưa được thêm vào CORS origins
Giải pháp: Thêm URL vào api-gateway/src/server.ts
```

### **Lỗi: Cannot connect to drone-db**
```
Nguyên nhân: Database chưa chạy
Giải pháp:
docker-compose up -d drone-db
docker logs drone-db
```

---

## 📝 Notes

1. **Không thay đổi cấu trúc code hiện tại** - Chỉ thêm mới routes và components
2. **API Gateway là single point of entry** - Tất cả requests đều qua gateway
3. **Authentication centralized** - API Gateway handle auth, services chỉ nhận user info
4. **Type-safe** - TypeScript interfaces cho tất cả API responses
5. **Mock data** - Dashboard vẫn dùng mockData cho stats, chỉ drone management dùng real API

---

## ✅ Checklist

- [x] Thêm drone-service URL vào API Gateway config
- [x] Tạo proxy middleware cho drone-service
- [x] Đăng ký routes `/api/drones` và `/api/deliveries`
- [x] Tạo `drone.service.ts` với tất cả API methods
- [x] Tạo `DroneManagementPage.tsx` với CRUD UI
- [x] Thêm route `/drones` vào App.tsx
- [x] Cập nhật Dashboard để link đến drone management
- [x] Test authentication flow
- [x] Verify API calls qua gateway

**✅ HOÀN TẤT - Admin Dashboard đã tích hợp với Drone Service!**

