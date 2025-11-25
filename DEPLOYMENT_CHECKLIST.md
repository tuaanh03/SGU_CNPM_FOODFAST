# 🚀 DEPLOYMENT CHECKLIST - FOOD DELIVERY MICROSERVICES

**Ngày tạo:** 25/11/2025  
**Version:** 1.0.0

---

## 📋 MỤC LỤC

1. [Kafka Events (Topics)](#1-kafka-events-topics)
2. [Frontend Socket URLs](#2-frontend-socket-urls)
3. [Frontend Mapbox Tokens](#3-frontend-mapbox-tokens)
4. [Backend Environment Variables](#4-backend-environment-variables)
5. [Services Sử Dụng Redis](#5-services-sử-dụng-redis)
6. [Deployment Steps](#6-deployment-steps)

---

## 1️⃣ KAFKA EVENTS (TOPICS)

### 📤 **PRODUCER EVENTS** (Services gửi events)

#### **ORDER-SERVICE** produces:
- `order.create` - Tạo đơn hàng mới
- `order.confirmed` - Đơn hàng được xác nhận sau payment
- `inventory.reserve` - Yêu cầu giữ tồn kho
- `inventory.release` - Giải phóng tồn kho

#### **PAYMENT-SERVICE** produces:
- `payment.event` - Kết quả thanh toán (success/failed)

#### **RESTAURANT-SERVICE** produces:
- `restaurant.order.status` - Cập nhật trạng thái từ nhà hàng
  - Events: `RESTAURANT_ORDER_STATUS_CHANGED`, `ORDER_READY_FOR_PICKUP`

#### **DRONE-SERVICE** produces:
- `drones.nearby` - Danh sách drone gần nhà hàng
- `drone.assigned` - Drone được gán cho đơn hàng
- `pickup.verified` - Merchant xác nhận OTP pickup
- `drone.location.update` - Cập nhật vị trí drone realtime
- `drone.arrived` - Drone đến nhà hàng
- `otp.generated` - OTP cho merchant (pickup)
- `customer.otp.generated` - OTP cho customer (delivery)
- `drone.arrived.at.customer` - Drone đến khách hàng
- `delivery.completed` - Giao hàng hoàn thành

#### **PRODUCT-SERVICE** produces:
- `product.sync` - Đồng bộ thông tin sản phẩm

#### **NOTIFICATION-SERVICE** produces:
- `notification.dlq` - Dead Letter Queue cho notification lỗi

---

### 📥 **CONSUMER EVENTS** (Services nhận events)

#### **ORDER-SERVICE** consumes:
- `payment.event` (từ payment-service)
- `inventory.reserve.result` (từ product-service)
- `product.sync` (từ product-service)
- `restaurant.order.status` (từ restaurant-service)
- `delivery.completed` (từ drone-service)

#### **PAYMENT-SERVICE** consumes:
- `order.create` (từ order-service)
- `order.retry.payment` (từ order-service)

#### **RESTAURANT-SERVICE** consumes:
- `order.confirmed` (từ order-service)
- `delivery.completed` (từ drone-service)

#### **DRONE-SERVICE** consumes:
- `restaurant.order.status` (từ restaurant-service)
  - Chỉ listen event: `ORDER_READY_FOR_PICKUP`

#### **SOCKET-SERVICE** consumes (Forward to WebSocket clients):
- `order.confirmed` → Emit đến merchant
- `restaurant.order.status` → Emit đến customer/merchant
- `drones.nearby` → Emit đến admin dashboard
- `drone.assigned` → Emit đến customer/merchant/admin
- `pickup.verified` → Emit đến customer/admin
- `otp.generated` → Emit đến merchant (restaurant)
- `drone.location.update` → Emit đến customer/admin (tracking)
- `drone.arrived` → Emit đến merchant/admin
- `delivery.completed` → Emit đến customer/merchant/admin
- `customer.otp.generated` → Emit đến customer
- `drone.arrived.at.customer` → Emit đến customer

---

### 🔑 **KAFKA TOPICS SUMMARY**

| Topic | Producer | Consumer(s) | Mô tả |
|-------|----------|-------------|-------|
| `order.create` | order-service | payment-service | Tạo đơn hàng mới |
| `order.confirmed` | order-service | restaurant-service, socket-service | Đơn hàng confirmed |
| `order.retry.payment` | order-service | payment-service | Retry thanh toán |
| `payment.event` | payment-service | order-service | Kết quả thanh toán |
| `inventory.reserve` | order-service | product-service | Giữ tồn kho |
| `inventory.reserve.result` | product-service | order-service | Kết quả giữ kho |
| `inventory.release` | order-service | product-service | Giải phóng kho |
| `product.sync` | product-service | order-service | Đồng bộ sản phẩm |
| `restaurant.order.status` | restaurant-service | order-service, drone-service, socket-service | Trạng thái từ merchant |
| `drones.nearby` | drone-service | socket-service | Drone gần nhà hàng |
| `drone.assigned` | drone-service | socket-service | Gán drone |
| `pickup.verified` | drone-service | socket-service | Merchant xác nhận pickup |
| `otp.generated` | drone-service | socket-service | OTP pickup |
| `drone.location.update` | drone-service | socket-service | Vị trí drone |
| `drone.arrived` | drone-service | socket-service | Drone đến restaurant |
| `customer.otp.generated` | drone-service | socket-service | OTP delivery |
| `drone.arrived.at.customer` | drone-service | socket-service | Drone đến customer |
| `delivery.completed` | drone-service | order-service, restaurant-service, socket-service | Giao hàng xong |
| `notification.dlq` | notification-service | - | DLQ notification |

---

## 2️⃣ FRONTEND SOCKET URLs

### **VITE_SOCKET_URL** - Biến môi trường cho Socket.IO

Tất cả 3 frontend apps cần cấu hình:

#### **1. admin-dashboard**
- File: `frontend/admin-dashboard/.env`
- Context: `src/contexts/AdminSocketContext.tsx`
- Default: `http://localhost:3011`
- Deploy: URL của socket-service

```env
VITE_SOCKET_URL=https://your-socket-service.railway.app
```

#### **2. cnpm-fooddelivery (Customer App)**
- File: `frontend/cnpm-fooddelivery/.env`
- Context: `src/contexts/CustomerSocketContext.tsx`
- Default: `http://localhost:3011`
- Deploy: URL của socket-service

```env
VITE_SOCKET_URL=https://your-socket-service.railway.app
```

#### **3. restaurant-merchant**
- File: `frontend/restaurant-merchant/.env`
- Context: `src/contexts/RestaurantSocketContext.tsx`
- Default: `http://localhost:3011`
- Deploy: URL của socket-service

```env
VITE_SOCKET_URL=https://your-socket-service.railway.app
```

---

## 3️⃣ FRONTEND MAPBOX TOKENS

### **VITE_MAPBOX_ACCESS_TOKEN** - Token cho Mapbox GL JS

Chỉ **admin-dashboard** sử dụng Mapbox để hiển thị bản đồ tracking drone.

#### **admin-dashboard**
- File: `frontend/admin-dashboard/.env`
- Components sử dụng:
  - `src/components/OrderMapSection.tsx`
  - `src/components/DroneTrackingMap.tsx`
- Lấy token tại: https://account.mapbox.com/access-tokens/

```env
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHgifQ.xxxxxxxxxxxxxx
```

**Lưu ý:** 
- Token cần có scopes: `styles:read`, `fonts:read`, `datasets:read`
- Nếu không có token, map sẽ hiển thị: "Chưa cấu hình VITE_MAPBOX_TOKEN"

---

## 4️⃣ BACKEND ENVIRONMENT VARIABLES

### **SERVICES CẦN CẤU HÌNH MỚI**

#### **A. KAFKA CONFIGURATION (Tất cả services)**

Tất cả backend services cần cấu hình Kafka:

```env
# Kafka Brokers (Railway/Confluent Cloud)
KAFKA_BROKERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092

# Kafka Authentication
KAFKA_SECURITY_PROTOCOL=SASL_SSL
KAFKA_USERNAME=your-api-key
KAFKA_PASSWORD=your-api-secret
```

**Services sử dụng Kafka:**
- ✅ order-service
- ✅ payment-service
- ✅ restaurant-service
- ✅ drone-service
- ✅ product-service
- ✅ socket-service
- ✅ notification-service

---

#### **B. LOCATION-SERVICE (MỚI)**

Service mới để geocoding địa chỉ Việt Nam.

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/location_db

# Google Maps API (Optional - cho geocoding chính xác hơn)
GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX

# Server
PORT=3009
```

**Endpoints:**
- `POST /geocode` - Chuyển địa chỉ VN thành lat/lng
- `POST /reverse-geocode` - Chuyển lat/lng thành địa chỉ

---

#### **C. RESTAURANT-SERVICE (CẬP NHẬT)**

Thêm biến môi trường mới:

```env
# Existing
DATABASE_URL=postgresql://...
PORT=3008

# ✅ MỚI: Kafka
KAFKA_BROKERS=...
KAFKA_USERNAME=...
KAFKA_PASSWORD=...
KAFKA_SECURITY_PROTOCOL=SASL_SSL

# ✅ MỚI: Location Service (internal)
LOCATION_SERVICE_URL=http://location-service:3009
```

**Chức năng mới:**
- Lưu latitude/longitude cho stores
- API `/stores/nearby` - Tìm cửa hàng gần khách hàng (10km)
- Emit event `restaurant.order.status` khi merchant cập nhật trạng thái

---

#### **D. DRONE-SERVICE (CẬP NHẬT QUAN TRỌNG)**

Thêm Redis và nhiều biến môi trường mới:

```env
# Existing
DATABASE_URL=postgresql://...
PORT=3010

# ✅ MỚI: Redis (Lưu OTP và vị trí drone realtime)
REDIS_HOST=redis-xxxxx.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# ✅ MỚI: Kafka
KAFKA_BROKERS=...
KAFKA_USERNAME=...
KAFKA_PASSWORD=...
KAFKA_SECURITY_PROTOCOL=SASL_SSL

# ✅ MỚI: OTP Configuration
OTP_EXPIRY_SECONDS=180
OTP_LENGTH=6

# ✅ MỚI: Drone Simulation
DRONE_SIMULATION_ENABLED=true
DRONE_UPDATE_INTERVAL_MS=3000
```

**Chức năng mới:**
- OTP cho merchant (pickup) và customer (delivery)
- Lưu OTP trong Redis (expire sau 180s)
- Simulation bay drone theo direction (Mapbox Directions API)
- Lưu vị trí drone trong Redis (không lưu DB)
- Emit 9 loại events qua Kafka

---

#### **E. SOCKET-SERVICE (CẬP NHẬT)**

```env
# Existing
PORT=3011

# ✅ MỚI: Kafka
KAFKA_BROKERS=...
KAFKA_USERNAME=...
KAFKA_PASSWORD=...
KAFKA_SECURITY_PROTOCOL=SASL_SSL

# ✅ MỚI: CORS Configuration
SOCKET_CORS_ORIGINS=https://admin-dashboard.vercel.app,https://customer-app.vercel.app,https://restaurant-merchant.vercel.app
```

**Chức năng mới:**
- Subscribe 13 Kafka topics
- Emit realtime events đến 3 frontends
- Handle join/leave rooms: `restaurant:{storeId}`, `order:{orderId}`, `dispatch`, `admin-dashboard`

---

#### **F. ORDER-SERVICE (CẬP NHẬT)**

Thêm Redis:

```env
# Existing
DATABASE_URL=postgresql://...
PORT=3004

# ✅ MỚI: Redis (Cache orders, OTP verification)
REDIS_HOST=redis-xxxxx.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Existing Kafka
KAFKA_BROKERS=...
```

**Chức năng mới:**
- Lưu `customerLatitude`, `customerLongitude` khi tạo order
- Cache order info trong Redis
- Listen event `delivery.completed` để update order status

---

## 5️⃣ SERVICES SỬ DỤNG REDIS

### **REDIS CONFIGURATION**

| Service | Sử dụng Redis | Mục đích | Biến môi trường |
|---------|---------------|----------|-----------------|
| **order-service** | ✅ | Cache orders, session | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| **cart-service** | ✅ | Lưu giỏ hàng | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| **drone-service** | ✅ **MỚI** | OTP (merchant/customer), Vị trí drone realtime | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| payment-service | ❌ | - | - |
| restaurant-service | ❌ | - | - |
| product-service | ❌ | - | - |
| socket-service | ❌ | - | - |
| location-service | ❌ | - | - |

### **Redis Configuration Template**

```env
# Railway Redis hoặc Upstash Redis
REDIS_HOST=redis-xxxxx.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password-here

# Hoặc local dev
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
```

**Lưu ý quan trọng:**
- **order-service** và **drone-service** có logic auto-detect:
  - Nếu `REDIS_HOST=redis` (Docker) → Dùng `localhost` khi local dev
  - Nếu deploy Railway → Dùng Redis URL từ Railway

---

## 6️⃣ DEPLOYMENT STEPS

### **A. KAFKA SETUP (Confluent Cloud hoặc Railway)**

1. **Tạo Kafka Cluster:**
   - Confluent Cloud: https://confluent.cloud
   - Hoặc Railway: Deploy Kafka service

2. **Tạo Topics:**
   ```bash
   # 19 topics cần tạo
   order.create
   order.confirmed
   order.retry.payment
   payment.event
   inventory.reserve
   inventory.reserve.result
   inventory.release
   product.sync
   restaurant.order.status
   drones.nearby
   drone.assigned
   pickup.verified
   otp.generated
   drone.location.update
   drone.arrived
   customer.otp.generated
   drone.arrived.at.customer
   delivery.completed
   notification.dlq
   ```

3. **Lấy credentials:**
   - API Key (Username)
   - API Secret (Password)
   - Bootstrap Servers (Brokers)

---

### **B. REDIS SETUP (Railway hoặc Upstash)**

1. **Deploy Redis:**
   - Railway: Add Redis service
   - Hoặc Upstash: https://upstash.com

2. **Lấy connection info:**
   - Host
   - Port
   - Password

3. **Cấu hình cho 3 services:**
   - order-service
   - cart-service
   - drone-service

---

### **C. FRONTEND DEPLOYMENT**

#### **1. admin-dashboard**
```env
VITE_API_URL=https://api-gateway.railway.app
VITE_SOCKET_URL=https://socket-service.railway.app
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4In0.xxx
```

#### **2. cnpm-fooddelivery**
```env
VITE_API_URL=https://api-gateway.railway.app
VITE_SOCKET_URL=https://socket-service.railway.app
```

#### **3. restaurant-merchant**
```env
VITE_API_URL=https://api-gateway.railway.app
VITE_SOCKET_URL=https://socket-service.railway.app
```

**Deploy platforms:**
- Vercel (recommended)
- Netlify
- Railway

---

### **D. BACKEND DEPLOYMENT PRIORITY**

Deploy theo thứ tự:

1. **Tier 1 - Core Services:**
   - ✅ Postgres Database
   - ✅ Redis
   - ✅ Kafka

2. **Tier 2 - Foundation:**
   - ✅ user-service
   - ✅ product-service
   - ✅ location-service (MỚI)

3. **Tier 3 - Business Logic:**
   - ✅ order-service (cập nhật Redis)
   - ✅ payment-service
   - ✅ restaurant-service (cập nhật Kafka)
   - ✅ cart-service

4. **Tier 4 - Delivery:**
   - ✅ drone-service (cập nhật Redis + Kafka)

5. **Tier 5 - Communication:**
   - ✅ socket-service (cập nhật Kafka)
   - ✅ notification-service

6. **Tier 6 - Gateway:**
   - ✅ api-gateway

---

## 📝 CHECKLIST TRƯỚC KHI DEPLOY

### **Backend Services**
- [ ] Tất cả services có `KAFKA_BROKERS`, `KAFKA_USERNAME`, `KAFKA_PASSWORD`
- [ ] order-service, cart-service, drone-service có Redis config
- [ ] restaurant-service có `LOCATION_SERVICE_URL`
- [ ] drone-service có `OTP_EXPIRY_SECONDS`, `OTP_LENGTH`
- [ ] socket-service có `SOCKET_CORS_ORIGINS` với frontend URLs

### **Frontend Apps**
- [ ] admin-dashboard có `VITE_SOCKET_URL` và `VITE_MAPBOX_ACCESS_TOKEN`
- [ ] cnpm-fooddelivery có `VITE_SOCKET_URL`
- [ ] restaurant-merchant có `VITE_SOCKET_URL`
- [ ] Tất cả có `VITE_API_URL` trỏ đến api-gateway

### **Kafka**
- [ ] 19 topics đã được tạo
- [ ] Credentials đã cấu hình cho 7 services

### **Redis**
- [ ] Redis instance đã deploy
- [ ] Connection info đã cấu hình cho 3 services

### **Database**
- [ ] Prisma migrations chạy cho tất cả services
- [ ] Stores đã có latitude/longitude
- [ ] Drones đã có baseLat/baseLng (vị trí ban đầu)

---

## 🆘 TROUBLESHOOTING

### **Socket không connect:**
- Kiểm tra `VITE_SOCKET_URL` có đúng không
- Kiểm tra `SOCKET_CORS_ORIGINS` có chứa frontend URL
- Kiểm tra socket-service logs

### **Kafka events không nhận:**
- Kiểm tra topics đã được tạo chưa
- Kiểm tra Kafka credentials
- Kiểm tra consumer group ID
- Check logs của producer và consumer services

### **Redis connection failed:**
- Kiểm tra `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Nếu dùng Railway Redis, dùng internal URL
- Check Redis logs

### **OTP không hiển thị:**
- Kiểm tra drone-service có kết nối Redis
- Kiểm tra socket-service có subscribe topic `otp.generated`, `customer.otp.generated`
- Check localStorage `droneArrivedOrders` ở customer app

### **Map không hiển thị:**
- Kiểm tra `VITE_MAPBOX_ACCESS_TOKEN` có đúng không
- Token phải có quyền `styles:read`, `fonts:read`
- Check browser console lỗi Mapbox

---

## 📞 SUPPORT

Nếu gặp vấn đề, check theo thứ tự:
1. Service logs
2. Kafka topics & consumer groups
3. Redis connection
4. Database migrations
5. Environment variables

---

**Created by:** Food Delivery Development Team  
**Last Updated:** November 25, 2025  
**Version:** 1.0.0

