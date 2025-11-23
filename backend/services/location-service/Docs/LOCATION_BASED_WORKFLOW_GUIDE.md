# 📍 HƯỚNG DẪN WORKFLOW TÍCH HỢP LOCATION-BASED VÀ MAP TRACKING

## 📋 MỤC LỤC
1. [Tổng Quan](#1-tổng-quan)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Workflow Chi Tiết](#3-workflow-chi-tiết)
4. [Các Service Liên Quan](#4-các-service-liên-quan)
5. [Database Schema Cần Bổ Sung](#5-database-schema-cần-bổ-sung)
6. [API Endpoints](#6-api-endpoints)
7. [Frontend Implementation](#7-frontend-implementation)
8. [Real-time Updates với Socket](#8-real-time-updates-với-socket)
9. [Map Integration với Mapbox](#9-map-integration-với-mapbox)
10. [Flow Diagram](#10-flow-diagram)

---

## 1. TỔNG QUAN

### 🎯 Mục Tiêu
Hệ thống sẽ tích hợp các tính năng dựa trên vị trí địa lý để cải thiện trải nghiệm người dùng và tối ưu hóa quá trình giao hàng:

1. **Gợi ý nhà hàng gần nhất**: Hiển thị danh sách nhà hàng gần người dùng nhất trên trang checkout
2. **Quản lý địa chỉ người dùng**: Cho phép người dùng chọn địa chỉ giao hàng đã lưu
3. **Gán drone thông minh**: Gợi ý drone gần nhà hàng nhất khi nhà hàng yêu cầu giao hàng
4. **Theo dõi realtime**: Admin và khách hàng có thể theo dõi vị trí drone trên bản đồ Mapbox

### 🏗️ Các Thành Phần Chính
- **location-service**: Quản lý địa chỉ, geocoding, tính khoảng cách
- **restaurant-service**: Lưu tọa độ nhà hàng, xử lý order
- **user-service**: Quản lý địa chỉ người dùng (đã có model Address)
- **drone-service**: Quản lý drone, delivery, cập nhật vị trí realtime
- **socket-service**: Phát sự kiện realtime cho tracking
- **Frontend**: Tích hợp Mapbox GL JS cho hiển thị bản đồ

---

## 2. KIẾN TRÚC HỆ THỐNG

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (Customer)                          │
│  - Xem nhà hàng gần nhất                                        │
│  - Chọn địa chỉ giao hàng                                       │
│  - Theo dõi drone trên map                                      │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (cnpm-fooddelivery)                  │
│  CheckoutPage:                                                   │
│  1. GET /api/users/addresses → Hiển thị danh sách địa chỉ      │
│  2. POST /api/locations/geocode → Lấy tọa độ từ địa chỉ        │
│  3. GET /api/stores/nearby?lat=x&lng=y → Gợi ý nhà hàng gần    │
│  4. POST /api/orders → Tạo order (kèm tọa độ)                   │
│                                                                  │
│  OrderTrackingPage:                                             │
│  1. Socket join room: order:{orderId}                           │
│  2. Listen: drone:location:update                               │
│  3. Render Mapbox với marker drone + route                      │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY                                 │
│  Route request đến các service tương ứng                        │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┬───────────┬────────────┬─────────────┐
    ▼                 ▼           ▼            ▼             ▼
┌─────────┐   ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐
│  USER   │   │  LOCATION    │  │RESTAURANT│  │  DRONE   │  │ SOCKET │
│ SERVICE │   │   SERVICE    │  │ SERVICE  │  │ SERVICE  │  │SERVICE │
└─────────┘   └──────────────┘  └──────────┘  └──────────┘  └────────┘
     │               │                 │            │             │
     │               │                 │            │             │
     ▼               ▼                 ▼            ▼             ▼
┌─────────┐   ┌──────────────┐  ┌──────────┐  ┌──────────┐  Redis
│   DB    │   │  Nominatim   │  │    DB    │  │    DB    │  Pub/Sub
│(Address)│   │  OSM API     │  │ (Store)  │  │ (Drone,  │
└─────────┘   └──────────────┘  └──────────┘  │Delivery) │
                                               └──────────┘
                                               
                    ┌──────────────────┐
                    │  KAFKA TOPICS    │
                    ├──────────────────┤
                    │ - order.created  │
                    │ - order.confirmed│
                    │ - order.ready    │
                    │ - drone.assigned │
                    └──────────────────┘
```

---

## 3. WORKFLOW CHI TIẾT

### 🛒 WORKFLOW 1: CHECKOUT - CHỌN ĐỊA CHỈ & HIỂN THỊ NHÀ HÀNG GẦN

#### Bước 1: User truy cập CheckoutPage
**Frontend (cnpm-fooddelivery/CheckoutPage.tsx)**
```
1. Component mount → Gọi API lấy danh sách địa chỉ đã lưu
   GET /api/users/addresses
   
2. Hiển thị dropdown/list các địa chỉ:
   - Địa chỉ mặc định được chọn sẵn
   - Có nút "Thêm địa chỉ mới"
   - Hiển thị: Tên địa chỉ, Số điện thoại, Địa chỉ đầy đủ
```

#### Bước 2: User chọn địa chỉ giao hàng
**Frontend Logic**
```
1. Khi user chọn 1 địa chỉ:
   - Nếu địa chỉ đã có latitude/longitude:
     → Gọi API qua Gateway: GET /api/stores/nearby?lat={lat}&lng={lng}&radius=10
   
   - Nếu địa chỉ chưa có tọa độ:
     → Gọi API qua Gateway: POST /api/locations/geocode với payload:
       {
         address: "123 Nguyễn Huệ",
         ward: "Bến Nghé",
         district: "Quận 1",
         province: "TP.HCM"
       }
     → Nhận response: { latitude, longitude }
     → Sau đó gọi API /api/stores/nearby

2. Hiển thị section "Nhà hàng gần bạn" (trong vòng 10km):
   - Card list các nhà hàng
   - Hiển thị khoảng cách (km)
   - Sắp xếp theo khoảng cách tăng dần
   - Có icon map pin với text "Cách bạn X.X km"
   - Badge "Gần nhất" cho store đầu tiên
   
3. Nếu KHÔNG có nhà hàng nào trong 10km:
   - Hiển thị message: "Không có nhà hàng nào trong bán kính 10km"
   - Suggest user: "Vui lòng chọn địa chỉ khác hoặc mở rộng bán kính tìm kiếm"
   
4. Validation khi user chọn nhà hàng:
   - Nếu distance > 10km → Hiển thị modal cảnh báo:
     "Nhà hàng này cách bạn {distance}km, vượt quá bán kính giao hàng (10km).
      Vui lòng chọn nhà hàng khác hoặc thay đổi địa chỉ giao hàng."
   - Button: "Chọn địa chỉ khác" | "Quay lại"
```

#### Bước 3: User chọn nhà hàng và đặt hàng
**Frontend → API Gateway → Order Service**
```
POST /api/orders/create
{
  "storeId": "uuid-of-restaurant",
  "items": [...],
  "deliveryAddress": {
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "address": "123 Nguyễn Huệ",
    "ward": "Bến Nghé",
    "district": "Quận 1",
    "province": "TP.HCM",
    "latitude": 10.7629,    // ← REQUIRED: lưu tọa độ khách hàng
    "longitude": 106.6602   // ← REQUIRED: lưu tọa độ khách hàng
  },
  "note": "Gọi điện trước khi giao"
}

Backend xử lý (order-service):
1. ⚠️ VALIDATION 10KM:
   a. Lấy store coordinates từ DB
   b. Calculate distance between store and delivery address:
      distance = ST_Distance(
        ST_MakePoint(store.longitude, store.latitude),
        ST_MakePoint(deliveryLng, deliveryLat)
      ) / 1000
   c. IF distance > 10:
      → Return error 400: "Địa chỉ giao hàng vượt quá bán kính 10km"
      → KHÔNG tạo order
   
2. IF distance <= 10:
   → Tạo Order record với fields:
     - deliveryLatitude
     - deliveryLongitude
     - estimatedDistance (km)
   → status: PENDING
   
3. Publish Kafka event: order.created
   {
     eventType: "ORDER_CREATED",
     orderId,
     storeId,
     items,
     totalPrice,
     deliveryAddress: {
       ...address,
       latitude,
       longitude
     },
     estimatedDistance: 2.5  // km
   }

4. Payment service subscribe → Xử lý payment
5. Payment success → Publish: payment.event (status: SUCCEEDED)
6. Order service consumer nhận → Update order.status = CONFIRMED
7. Publish: order.confirmed (KAFKA)
8. Restaurant service consumer nhận → Tạo RestaurantOrder

⚠️ LƯU Ý: 
- Services KHÔNG gọi HTTP API của nhau
- Tất cả communication qua KAFKA
- Order service tự validate distance (có store.latitude/longitude trong DB)
```

---

### 🏪 WORKFLOW 2: RESTAURANT - CHUẨN BỊ & YÊU CẦU DRONE

#### Bước 1: Merchant xác nhận đơn
**Frontend (restaurant-merchant)**
```
1. Merchant đăng nhập → Xem danh sách đơn hàng mới
2. Click "Xác nhận" → Call API:
   PUT /api/stores/orders/{restaurantOrderId}/confirm
   
Backend (restaurant-service):
- Update restaurantStatus: "CONFIRMED" → "PREPARING"
- Update confirmedAt, preparingStartedAt
- Publish Kafka: restaurant.order.status với eventType: ORDER_PREPARING
```

#### Bước 2: Món ăn đã sẵn sàng
**Frontend (restaurant-merchant)**
```
1. Merchant click nút "Đã sẵn sàng - Gọi drone"
   PUT /api/stores/orders/{restaurantOrderId}/ready
   
Backend (restaurant-service):
- Update restaurantStatus: "PREPARING" → "READY_FOR_PICKUP"
- Update readyAt: new Date()
- Publish Kafka event:
  Topic: restaurant.order.status
  Payload: {
    eventType: "ORDER_READY_FOR_PICKUP",
    orderId: "...",
    storeId: "...",
    readyAt: "2024-01-15T10:30:00Z",
    pickupLocation: {
      storeId: "...",
      restaurantName: "Cơm Tấm Sườn Bì Chả",
      address: "45 Lê Lợi, Q1, TP.HCM",
      latitude: 10.7750,
      longitude: 106.7008
    },
    deliveryDestination: {
      customerName: "Nguyễn Văn A",
      customerPhone: "0901234567",
      address: "123 Nguyễn Huệ, Q1, TP.HCM",
      latitude: 10.7629,
      longitude: 106.6602
    },
    items: [...],
    totalPrice: 150000
  }
```

#### Bước 3: Drone Service nhận event (QUA KAFKA)
**Backend (drone-service/kafka consumer)**
```
Consumer subscribe topic: restaurant.order.status
Group ID: drone-service-group

Khi nhận event ORDER_READY_FOR_PICKUP:

1. ⚠️ Validate distance (double-check):
   distance = ST_Distance(
     ST_MakePoint(pickupLng, pickupLat),
     ST_MakePoint(deliveryLng, deliveryLat)
   ) / 1000
   
   IF distance > 10:
     → Log warning (không nên xảy ra vì đã validate ở order creation)
     → Skip hoặc mark delivery as INVALID
     
2. Tính estimated time:
   estimatedTime = distance / averageSpeed (ví dụ: 40km/h)
   → 2.5km / 40 = 0.0625h = ~4 phút

3. Tìm drone phù hợp GẦN NHÀ HÀNG nhất:
   SELECT 
     *,
     ST_Distance(
       ST_MakePoint(currentLng, currentLat)::geography,
       ST_MakePoint({pickupLng}, {pickupLat})::geography
     ) / 1000 as distanceToRestaurant
   FROM drones
   WHERE status = 'AVAILABLE'
     AND battery >= 30
     AND maxRange >= {distance} * 1.5  -- Đảm bảo drone có thể bay đủ
     AND maxPayload >= {estimatedWeight}
     AND ST_Distance(
       ST_MakePoint(currentLng, currentLat)::geography,
       ST_MakePoint({pickupLng}, {pickupLat})::geography
     ) / 1000 <= 5  -- ⭐ Chỉ lấy drone trong bán kính 5km từ restaurant
   ORDER BY distanceToRestaurant ASC
   LIMIT 5

3. Upsert Delivery record (idempotent by orderId):
   await prisma.delivery.upsert({
     where: { orderId },
     update: { status: 'PENDING' },
     create: {
       orderId,
       droneId: null, // Chưa gán
       restaurantName,
       restaurantLat,
       restaurantLng,
       restaurantAddress,
       customerName,
       customerPhone,
       customerLat,
       customerLng,
       customerAddress,
       distance,
       estimatedTime,
       status: 'PENDING'
     }
   })

4. Publish event (optional):
   Topic: delivery.created
   → Socket service lắng nghe → emit đến room 'dispatch'
```

#### Bước 4: Socket Service emit realtime
**Backend (socket-service)**
```
Consumer subscribe: restaurant.order.status

Khi nhận ORDER_READY_FOR_PICKUP:
1. Emit đến room 'dispatch' (cho admin-dashboard):
   io.to('dispatch').emit('dispatch:delivery:created', {
     orderId,
     storeId,
     restaurantName,
     restaurantLat,
     restaurantLng,
     restaurantAddress,
     customerName,
     customerAddress,
     customerLat,
     customerLng,
     distance,
     estimatedTime,
     status: 'PENDING',
     readyAt: new Date(),
     suitableDrones: [...] // Top 5 drones gần nhất
   })

2. Emit đến room restaurant:{storeId}:
   io.to(`restaurant:${storeId}`).emit('order:ready:confirmed', {
     orderId,
     message: "Đơn hàng đã sẵn sàng, đang tìm drone..."
   })
```

---

### 🚁 WORKFLOW 3: ADMIN - GÁN DRONE & XEM MAP

#### Bước 1: Admin vào Dispatch Queue Page
**Frontend (admin-dashboard/DispatchQueuePage.tsx)**
```
1. Component mount:
   - Connect socket
   - emit('join:dispatch')
   - Listen event: 'dispatch:delivery:created'
   
2. Fetch danh sách delivery chờ xử lý:
   GET /api/deliveries?status=PENDING
   
3. Hiển thị real-time queue:
   - Mỗi delivery card hiển thị:
     + Order ID
     + Restaurant info + địa chỉ
     + Customer info + địa chỉ
     + Khoảng cách (km)
     + Thời gian ước tính
     + Nút "Chi tiết & Gán Drone"
```

#### Bước 2: Admin click vào delivery để xem chi tiết
**Frontend (admin-dashboard/OrderDetailPage.tsx)**
```
Navigation: /orders/{orderId}/delivery

1. Fetch delivery detail:
   GET /api/deliveries/{deliveryId}
   hoặc GET /api/deliveries/order/{orderId}
   
Response:
{
  id: "delivery-uuid",
  orderId: "order-uuid",
  restaurantName: "...",
  restaurantLat: 10.775,
  restaurantLng: 106.7008,
  restaurantAddress: "...",
  customerName: "...",
  customerLat: 10.7629,
  customerLng: 106.6602,
  customerAddress: "...",
  distance: 2.5,
  estimatedTime: 15,
  status: "PENDING",
  suitableDrones: [...]
}

2. Hiển thị MAP SECTION (Mapbox):
   - Initialize Mapbox với center giữa restaurant và customer
   - Add marker (🏪) tại vị trí restaurant
   - Add marker (📍) tại vị trí customer
   - Draw line/route giữa 2 điểm
   - Hiển thị khoảng cách trên map
   
3. Hiển thị section "Drone Gần Nhất":
   GET /api/drones/nearby?lat={restaurantLat}&lng={restaurantLng}&status=AVAILABLE
   
Response mẫu:
[
  {
    id: "drone-1",
    name: "Drone Alpha",
    model: "DJI Mavic Pro",
    battery: 85,
    currentLat: 10.7730,
    currentLng: 106.7000,
    distanceToRestaurant: 0.8, // km
    status: "AVAILABLE"
  },
  {...}
]

4. Render danh sách drone cards:
   - Hiển thị: Tên, Model, Pin, Khoảng cách đến nhà hàng
   - Thêm marker drone (🚁) lên map với màu khác nhau
   - Highlight khi hover
   - Nút "Chọn Drone"
```

#### Bước 3: Admin chọn drone
**Frontend Action**
```
1. Click "Chọn Drone" → Call API:
   POST /api/deliveries/{deliveryId}/assign-drone
   {
     droneId: "drone-1"
   }

Backend (drone-service) xử lý:
1. Update delivery:
   - status: PENDING → ASSIGNED
   - droneId: "drone-1"
   - assignedAt: new Date()

2. Update drone:
   - status: AVAILABLE → IN_USE
   
3. Publish Kafka event:
   Topic: drone.assigned
   Payload: {
     deliveryId,
     orderId,
     droneId,
     restaurantLat,
     restaurantLng,
     customerLat,
     customerLng
   }

4. Socket service nhận event → emit:
   - io.to(`order:${orderId}`).emit('drone:assigned', {...})
   - io.to('dispatch').emit('delivery:updated', {...})
   - io.to(`restaurant:${storeId}`).emit('drone:on_the_way', {...})
```

#### Bước 4: Navigate to Real-time Tracking
**Frontend (admin-dashboard/RouteTrackingPage.tsx)**
```
Navigation: /orders/{orderId}/tracking

1. Initialize:
   - Connect socket
   - emit('join:tracking', { orderId })
   - Listen: 'drone:location:update'
   
2. Fetch initial data:
   GET /api/deliveries/{deliveryId}/tracking
   
Response:
{
  delivery: {...},
  drone: {
    id: "drone-1",
    name: "Drone Alpha",
    currentLat: 10.7730,
    currentLng: 106.7000,
    battery: 85,
    speed: 35 // km/h
  },
  route: {
    origin: { lat, lng },
    destination: { lat, lng },
    waypoints: [...]
  },
  status: "PICKING_UP" // hoặc "IN_TRANSIT"
}

3. Render Mapbox:
   - Center map với route
   - Marker restaurant (🏪)
   - Marker customer (📍)
   - Marker drone (🚁) - animated
   - Draw route line với màu gradient
   - Hiển thị ETA, Distance remaining

4. Real-time updates (socket):
   socket.on('drone:location:update', (data) => {
     // data: { droneId, lat, lng, battery, speed, altitude }
     
     // Animate drone marker từ vị trí cũ → mới
     updateDroneMarker(data)
     
     // Cập nhật thông tin sidebar
     updateDroneStats(data)
     
     // Tính lại ETA
     recalculateETA(data)
   })

5. Status updates:
   socket.on('delivery:status:update', (data) => {
     // data: { deliveryId, status, timestamp }
     // status: PICKING_UP → PICKED_UP → IN_TRANSIT → DELIVERED
     
     updateUI(data.status)
     showNotification(data)
   })
```

---

### 👤 WORKFLOW 4: CUSTOMER - THEO DÕI DRONE

#### Frontend (cnpm-fooddelivery/OrderTrackingPage.tsx)
```
1. Customer vào "Đơn hàng của tôi" → Click vào order đang giao

2. Component logic tương tự admin tracking:
   - Socket join room: order:{orderId}
   - Listen: drone:location:update
   - Render Mapbox tương tự
   - Hiển thị:
     + Vị trí drone realtime
     + Thời gian giao dự kiến (ETA)
     + Thông tin drone (tên, pin)
     + Route từ restaurant → customer

3. Notifications:
   - "Drone đang đến nhà hàng lấy món" (PICKING_UP)
   - "Drone đã lấy món, đang giao đến bạn" (IN_TRANSIT)
   - "Drone đã đến, vui lòng ra nhận hàng" (ARRIVED)
   - "Giao hàng thành công" (DELIVERED)
```

---

## 4. CÁC SERVICE LIÊN QUAN

### ⚠️ QUY TẮC GIAO TIẾP GIỮA SERVICES (BẮT BUỘC)

**1. Frontend → Backend:**
```
❌ KHÔNG ĐƯỢC: Frontend gọi trực tiếp service URLs
   Frontend → http://restaurant-service:3004/stores

✅ PHẢI: Frontend gọi qua API Gateway
   Frontend → http://api-gateway:3000/api/stores
   API Gateway → restaurant-service:3004/stores
```

**2. Service → Service:**
```
❌ KHÔNG ĐƯỢC: Service gọi trực tiếp HTTP API của service khác
   restaurant-service → http://location-service:3007/geocode

✅ PHẢI: Service giao tiếp qua Kafka Events
   restaurant-service → Kafka topic → location-service consumer
```

**3. Kafka Topics mới cần thêm:**
```
Ngoài các topics hiện có:
- order.create
- order.confirmed
- payment.event
- restaurant.order.status

Cần thêm (nếu cần):
- location.geocode.request   (optional - nếu service cần geocode async)
- location.geocode.response  (optional)
- store.distance.request     (optional - nếu cần tính distance async)
- store.distance.response    (optional)

⚠️ LƯU Ý: 
- Với location service, CÓ THỂ cho phép sync call qua Gateway
  vì đây là utility service, không chứa business logic phức tạp
- Nhưng restaurant, order, drone services BẮT BUỘC dùng Kafka
```

**4. Giới hạn 10km:**
```
⭐ HARD LIMIT: 10km được enforce ở MỌI LỚP

Layer 1 - Database Query (restaurant-service):
  WHERE distance <= 10

Layer 2 - API Response Validation:
  stores.filter(s => s.distance <= 10)

Layer 3 - Frontend Validation:
  if (selectedStore.distance > 10) {
    showError("Nhà hàng vượt quá bán kính 10km");
    return;
  }

Layer 4 - Order Creation Validation:
  Before creating order, validate distance again
  Reject nếu distance > 10km
```

### 📡 Location Service
**Chức năng:**
- Geocoding: Chuyển địa chỉ text → tọa độ (lat, lng)
- Reverse Geocoding: Tọa độ → địa chỉ text
- Search địa chỉ (autocomplete)
- Tính khoảng cách giữa 2 điểm
- Lấy danh sách tỉnh/quận/phường Việt Nam

**Tech Stack:**
- OpenStreetMap Nominatim API (free, không cần API key)
- Hoặc Google Maps Geocoding API (cần API key)
- PostGIS extension cho PostgreSQL (tính distance)

**⚠️ QUAN TRỌNG - API Call Pattern:**
```
Frontend → API Gateway → Location Service

Ví dụ:
Frontend:
  fetch('http://api-gateway:3000/api/locations/geocode', {...})
  
API Gateway (server.ts):
  server.use("/api/locations", proxy(config.services.locationService, {
    ...proxyOptions
  }));

Location Service:
  Nhận request từ gateway, xử lý, return response
```

**APIs:**
```typescript
// 1. Geocode address (QUA GATEWAY)
POST /api/locations/geocode
Body: {
  address: string,
  ward: string,
  district: string,
  province: string
}
Response: {
  success: true,
  data: {
    latitude: number,
    longitude: number,
    formattedAddress: string
  }
}

// 2. Reverse geocode
GET /api/locations/reverse?lat=10.7629&lng=106.6602
Response: {
  success: true,
  data: {
    address: string,
    ward: string,
    district: string,
    province: string
  }
}

// 3. Calculate distance
POST /api/locations/distance
Body: {
  from: { lat: number, lng: number },
  to: { lat: number, lng: number }
}
Response: {
  success: true,
  data: {
    distance: number, // km
    duration: number  // phút
  }
}

// 4. Search address (autocomplete)
GET /api/locations/search?q=nguyen+hue&limit=5
Response: {
  success: true,
  data: [
    {
      displayName: "123 Nguyễn Huệ, Bến Nghé, Q1, TP.HCM",
      latitude: 10.7629,
      longitude: 106.6602,
      address: "123 Nguyễn Huệ",
      ward: "Bến Nghé",
      district: "Quận 1",
      province: "TP.HCM"
    }
  ]
}
```

---

### 🏪 Restaurant Service (Bổ sung)

**Thêm tọa độ cho Store:**
```typescript
// Model Store đã có latitude, longitude (✓)

// API: Tìm nhà hàng gần (GỌI QUA API GATEWAY)
GET /api/stores/nearby?lat=10.7629&lng=106.6602&radius=10

⚠️ LƯU Ý: 
- radius mặc định = 10km (BẮT BUỘC)
- API Gateway proxy request → restaurant-service
- Không cho phép frontend gọi trực tiếp restaurant-service

Controller logic (restaurant-service):
1. Validate input:
   - lat: -90 to 90
   - lng: -180 to 180
   - radius: mặc định 10, tối đa 10 (không cho vượt quá)
   
2. Dùng PostGIS ST_Distance để tính khoảng cách:
   SELECT *, 
     ST_Distance(
       ST_MakePoint(longitude, latitude)::geography,
       ST_MakePoint({lng}, {lat})::geography
     ) / 1000 as distance  -- Convert to km
   FROM stores
   WHERE isActive = true
     AND latitude IS NOT NULL
     AND longitude IS NOT NULL
     AND ST_Distance(
       ST_MakePoint(longitude, latitude)::geography,
       ST_MakePoint({lng}, {lat})::geography
     ) / 1000 <= {radius}  -- ⭐ GIỚi HẠN 10KM
   ORDER BY distance ASC
   LIMIT 50;

3. Return stores với distance

Response:
{
  success: true,
  data: [
    {
      id: "store-uuid",
      name: "Cơm Tấm Sườn Bì Chả",
      address: "45 Lê Lợi, Q1",
      latitude: 10.7750,
      longitude: 106.7008,
      distance: 1.2, // km (luôn <= 10)
      avatar: "https://...",
      rating: 4.5,
      openTime: "08:00",
      closeTime: "22:00",
      isOpen: true  // Check thời gian hiện tại
    }
  ],
  meta: {
    radius: 10,
    total: 5,
    userLocation: { lat: 10.7629, lng: 106.6602 }
  }
}
```

---

### 🚁 Drone Service (Bổ sung)

**APIs mới:**
```typescript
// 1. Tìm drone gần vị trí
GET /api/drones/nearby?lat=10.775&lng=106.7008&status=AVAILABLE&limit=5

Controller:
- Filter: status = AVAILABLE, battery >= 30
- Tính khoảng cách từ drone.currentLat/Lng đến lat/lng
- Sort by distance ASC
- Return drones với field distanceToLocation

// 2. Gán drone cho delivery
POST /api/deliveries/{deliveryId}/assign-drone
Body: { droneId: string }

// 3. Cập nhật vị trí drone (gọi định kỳ hoặc từ drone simulator)
PUT /api/drones/{droneId}/location
Body: {
  latitude: number,
  longitude: number,
  altitude: number,
  battery: number,
  speed: number
}

// 4. Get tracking info
GET /api/deliveries/{deliveryId}/tracking
Response: {
  delivery: {...},
  drone: { currentLat, currentLng, battery, speed },
  trackingPoints: [
    { lat, lng, timestamp, battery, speed }
  ]
}
```

---

### 🔌 Socket Service (Bổ sung)

**Rooms:**
- `dispatch`: Admin dispatch queue
- `order:{orderId}`: Tracking cho order cụ thể
- `restaurant:{storeId}`: Merchant theo dõi đơn hàng
- `drone:{droneId}`: Admin theo dõi drone cụ thể (optional)

**Events:**
```typescript
// Server emit
socket.emit('dispatch:delivery:created', deliveryData)
socket.emit('drone:assigned', { orderId, droneId, droneInfo })
socket.emit('drone:location:update', { 
  droneId, 
  deliveryId, 
  lat, 
  lng, 
  battery, 
  speed,
  timestamp 
})
socket.emit('delivery:status:update', { 
  deliveryId, 
  orderId, 
  status, 
  timestamp 
})

// Client emit
socket.emit('join:dispatch')
socket.emit('join:tracking', { orderId })
socket.emit('leave:tracking', { orderId })
```

---

## 5. DATABASE SCHEMA CẦN BỔ SUNG

### User Service - Address (✓ Đã có)
```prisma
model Address {
  id        String  @id @default(uuid())
  userId    String
  name      String
  phone     String
  address   String
  ward      String
  district  String
  province  String
  isDefault Boolean @default(false)
  latitude  Float?  // ✓ Đã có
  longitude Float?  // ✓ Đã có
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([latitude, longitude]) // ← Cần thêm index
}
```

### Restaurant Service - Store (✓ Đã có)
```prisma
model Store {
  id          String  @id @default(uuid())
  ownerId     String  @unique
  name        String
  address     String
  ward        String
  district    String
  province    String
  latitude    Float?  // ✓ Đã có
  longitude   Float?  // ✓ Đã có
  // ...existing fields
  
  @@index([latitude, longitude]) // ← Cần thêm index
  @@index([district, isActive])
}
```

### Order Service - Order (Cần bổ sung)
```prisma
model Order {
  id       String @id @default(uuid())
  userId   String
  storeId  String
  // ...existing fields
  
  // ← Thêm các field địa chỉ giao hàng
  deliveryName      String?
  deliveryPhone     String?
  deliveryAddress   String?
  deliveryWard      String?
  deliveryDistrict  String?
  deliveryProvince  String?
  deliveryLatitude  Float?  // ← Mới
  deliveryLongitude Float?  // ← Mới
  
  // ...rest
}
```

### Drone Service (✓ Cấu trúc tốt)
```prisma
// Không cần sửa, schema hiện tại đã đầy đủ
model Drone {
  currentLat Float? // ✓
  currentLng Float? // ✓
  // ...
  @@index([status])
  @@index([currentLat, currentLng]) // ← Cần thêm
}

model Delivery {
  restaurantLat     Float  // ✓
  restaurantLng     Float  // ✓
  restaurantAddress String // ✓
  customerLat       Float  // ✓
  customerLng       Float  // ✓
  customerAddress   String // ✓
  // ...
}

model TrackingPoint {
  deliveryId String
  lat        Float
  lng        Float
  altitude   Float?
  speed      Float?
  battery    Int
  timestamp  DateTime @default(now())
  // ✓ Perfect cho real-time tracking
}
```

---

## 6. API ENDPOINTS

### ⚠️ TẤT CẢ REQUESTS ĐI QUA API GATEWAY

**API Gateway Configuration (cần thêm vào server.ts):**
```typescript
// Location Service Proxy
server.use("/api/locations", 
  proxy(config.services.locationService, {
    proxyReqPathResolver: (req) => {
      return `/locations${req.url}`;
    },
    ...proxyOptions
  })
);

// Restaurant Service - Already exists, ensure it includes:
server.use("/api/stores", 
  proxy(config.services.restaurantService, {
    // nearby endpoint available
  })
);

// Drone Service Proxy (if needed for direct queries)
server.use("/api/drones",
  authenticateToken,  // Protect admin-only endpoints
  proxy(config.services.droneService, {
    ...proxyOptions
  })
);
```

### 📍 Location Service (QUA GATEWAY)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/locations/geocode` | Chuyển địa chỉ → tọa độ | No |
| GET | `/api/locations/reverse` | Chuyển tọa độ → địa chỉ | No |
| POST | `/api/locations/distance` | Tính khoảng cách | No |
| GET | `/api/locations/search` | Tìm kiếm địa chỉ | No |
| GET | `/api/locations/provinces` | Danh sách tỉnh/thành | No |
| GET | `/api/locations/districts/:provinceId` | Danh sách quận/huyện | No |
| GET | `/api/locations/wards/:districtId` | Danh sách phường/xã | No |

### 🏪 Restaurant Service (QUA GATEWAY)
| Method | Endpoint | Description | Auth | Distance Limit |
|--------|----------|-------------|------|----------------|
| GET | `/api/stores/nearby` | Tìm nhà hàng gần (⭐ max 10km) | No | 10km |
| PUT | `/api/stores/:id/location` | Cập nhật tọa độ nhà hàng | STORE_ADMIN | - |
| PUT | `/api/stores/orders/:id/ready` | Báo đơn hàng sẵn sàng (→ Kafka) | STORE_ADMIN | - |

### 👤 User Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/addresses` | Lấy danh sách địa chỉ |
| POST | `/api/users/addresses` | Thêm địa chỉ mới |
| PUT | `/api/users/addresses/:id` | Cập nhật địa chỉ |
| DELETE | `/api/users/addresses/:id` | Xóa địa chỉ |
| PUT | `/api/users/addresses/:id/default` | Đặt địa chỉ mặc định |

### 🚁 Drone Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drones/nearby` | Tìm drone gần vị trí |
| PUT | `/api/drones/:id/location` | Cập nhật vị trí drone |
| GET | `/api/deliveries` | Danh sách delivery |
| GET | `/api/deliveries/:id` | Chi tiết delivery |
| GET | `/api/deliveries/order/:orderId` | Lấy delivery theo orderId |
| POST | `/api/deliveries/:id/assign-drone` | Gán drone |
| GET | `/api/deliveries/:id/tracking` | Lấy tracking info |
| PUT | `/api/deliveries/:id/status` | Cập nhật status |

---

## 7. FRONTEND IMPLEMENTATION

### 🛒 CheckoutPage Updates

**Components cần thêm:**
```
CheckoutPage.tsx
├── AddressSelector.tsx        // Dropdown chọn địa chỉ
├── AddressForm.tsx           // Form thêm địa chỉ mới
├── NearbyRestaurants.tsx     // Hiển thị nhà hàng gần
└── RestaurantCard.tsx        // Card từng nhà hàng
```

**Flow:**
```typescript
1. User chọn địa chỉ từ dropdown
   ↓
2. Nếu địa chỉ có lat/lng → gọi /api/stores/nearby
   Nếu không có → gọi /api/locations/geocode trước
   ↓
3. Hiển thị danh sách nhà hàng gần (sorted by distance)
   ↓
4. User chọn nhà hàng (optional: filter products của nhà hàng đó)
   ↓
5. Proceed to checkout với storeId + delivery coordinates
```

**UI/UX:**
- Icon 📍 cho vị trí hiện tại
- Badge "Gần nhất" cho nhà hàng đầu tiên
- Hiển thị khoảng cách với icon 🚶‍♂️ hoặc 🚗
- Estimate delivery time dựa trên distance

---

### 🎛️ Admin Dashboard Updates

**DispatchQueuePage.tsx:**
```typescript
Features:
- Real-time notification với badge đỏ
- Auto-refresh queue mỗi 30s (+ socket updates)
- Filter: ALL / PENDING / ASSIGNED / IN_TRANSIT
- Search by orderId, customer name
- Mỗi delivery card:
  + Restaurant info (name, address)
  + Customer info (name, address)
  + Distance, ETA
  + Button "Chi tiết & Gán Drone"
```

**OrderDetailPage.tsx (Delivery Mode):**
```typescript
Sections:
1. Order Summary
   - Order items
   - Total price
   - Customer info
   - Restaurant info

2. Map View (Mapbox)
   - Restaurant marker (🏪)
   - Customer marker (📍)
   - Route line
   - Available drones nearby (🚁)
   - Click drone → highlight

3. Drone Selection Panel
   - List of suitable drones
   - Card mỗi drone:
     + Name, Model
     + Battery level (progress bar)
     + Distance to restaurant
     + Status (AVAILABLE)
     + Button "Gán Drone"

4. Action Buttons
   - "Gán Drone" → POST /api/deliveries/{id}/assign-drone
   - "Xem Tracking" → navigate to RouteTrackingPage
```

**RouteTrackingPage.tsx:**
```typescript
Layout:
┌─────────────────────┬──────────────┐
│                     │  Drone Info  │
│                     ├──────────────┤
│    MAPBOX           │  - Name      │
│    Full height      │  - Battery   │
│                     │  - Speed     │
│    Markers:         │  - ETA       │
│    🏪 Restaurant    ├──────────────┤
│    🚁 Drone         │  Status      │
│    📍 Customer      ├──────────────┤
│                     │ Timeline     │
│    Route line       │ - Ready      │
│                     │ - Picking up │
│                     │ - In transit │
│                     │ - Delivered  │
└─────────────────────┴──────────────┘

Real-time updates:
- Socket updates drone position → animate marker
- Update ETA dynamically
- Status changes → update timeline
- Battery changes → update progress bar
```

---

### 👤 Customer App Updates

**OrderTrackingPage.tsx (Customer View):**
```typescript
Tương tự admin tracking nhưng đơn giản hơn:
- Full-screen map
- Bottom sheet với:
  + Order status
  + ETA
  + Drone info (tên, ảnh)
  + Contact driver button (optional)
- Real-time updates via socket
- Push notifications khi status changes
```

---

## 8. REAL-TIME UPDATES VỚI SOCKET

### Socket Flow

**1. Khi delivery được tạo:**
```
restaurant-service (ready) 
  → Kafka (ORDER_READY_FOR_PICKUP)
  → drone-service (create delivery)
  → Kafka (DELIVERY_CREATED)
  → socket-service
  → emit('dispatch:delivery:created') to room 'dispatch'
```

**2. Khi drone được gán:**
```
admin-dashboard (assign drone)
  → drone-service (update delivery + drone)
  → Kafka (DRONE_ASSIGNED)
  → socket-service
  → emit('drone:assigned') to room order:{orderId}
  → emit('delivery:updated') to room 'dispatch'
```

**3. Khi drone di chuyển:**
```
Option A: Drone Simulator (cron job)
  - Mỗi 5 giây, tính vị trí mới của drone dựa trên route
  - PUT /api/drones/{id}/location
  → drone-service save to DB + create TrackingPoint
  → Kafka (DRONE_LOCATION_UPDATED)
  → socket-service
  → emit('drone:location:update') to room order:{orderId}

Option B: Real device GPS
  - Drone device gửi GPS via MQTT/HTTP
  - Backend xử lý tương tự
```

**4. Khi status delivery thay đổi:**
```
drone-service (update status: PICKING_UP → IN_TRANSIT → DELIVERED)
  → Kafka (DELIVERY_STATUS_CHANGED)
  → socket-service
  → emit('delivery:status:update') to:
     - order:{orderId}
     - dispatch
     - restaurant:{storeId}
```

---

## 9. MAP INTEGRATION VỚI MAPBOX

### Setup Mapbox GL JS

**1. Installation:**
```bash
npm install mapbox-gl
npm install @types/mapbox-gl
```

**2. Get Mapbox Token:**
- Đăng ký tại: https://www.mapbox.com/
- Lấy Access Token (free tier: 50k requests/month)
- Lưu vào `.env`: `VITE_MAPBOX_TOKEN=pk.xxxxx`

**3. Component Structure:**
```typescript
// components/Map/DeliveryMap.tsx
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface DeliveryMapProps {
  restaurantLat: number;
  restaurantLng: number;
  customerLat: number;
  customerLng: number;
  droneLat?: number;
  droneLng?: number;
  nearbyDrones?: Drone[];
  onDroneClick?: (droneId: string) => void;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ ... }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [markers, setMarkers] = useState({
    restaurant: null,
    customer: null,
    drone: null,
    nearbyDrones: []
  });

  useEffect(() => {
    // Initialize map
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [restaurantLng, restaurantLat],
      zoom: 13
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add markers
    addRestaurantMarker();
    addCustomerMarker();
    drawRoute();
    
    return () => map.current?.remove();
  }, []);

  useEffect(() => {
    // Update drone position
    if (droneLat && droneLng) {
      updateDroneMarker(droneLat, droneLng);
    }
  }, [droneLat, droneLng]);

  const addRestaurantMarker = () => {
    // Custom marker với icon 🏪
    const el = document.createElement('div');
    el.className = 'custom-marker restaurant-marker';
    el.innerHTML = '🏪';
    el.style.fontSize = '32px';
    
    const marker = new mapboxgl.Marker(el)
      .setLngLat([restaurantLng, restaurantLat])
      .setPopup(
        new mapboxgl.Popup().setHTML('<h3>Nhà Hàng</h3>')
      )
      .addTo(map.current!);
    
    setMarkers(prev => ({ ...prev, restaurant: marker }));
  };

  const addCustomerMarker = () => {
    // Tương tự với icon 📍
  };

  const updateDroneMarker = (lat: number, lng: number) => {
    if (markers.drone) {
      // Animate marker từ vị trí cũ → mới
      const start = markers.drone.getLngLat();
      const end = { lng, lat };
      
      animateMarker(markers.drone, start, end, 1000);
    } else {
      // Create new drone marker
      const el = document.createElement('div');
      el.className = 'drone-marker';
      el.innerHTML = '🚁';
      el.style.fontSize = '28px';
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current!);
      
      setMarkers(prev => ({ ...prev, drone: marker }));
    }
  };

  const drawRoute = () => {
    // Fetch route từ Mapbox Directions API
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${restaurantLng},${restaurantLat};${customerLng},${customerLat}?geometries=geojson&access_token=${mapboxgl.accessToken}`)
      .then(res => res.json())
      .then(data => {
        const route = data.routes[0].geometry;
        
        map.current!.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route
          }
        });
        
        map.current!.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 0.8
          }
        });
        
        // Fit map to show entire route
        const bounds = new mapboxgl.LngLatBounds();
        route.coordinates.forEach((coord: [number, number]) => {
          bounds.extend(coord);
        });
        map.current!.fitBounds(bounds, { padding: 50 });
      });
  };

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
};
```

### Custom Marker Styles
```css
/* styles/map.css */
.custom-marker {
  cursor: pointer;
  transition: transform 0.2s;
}

.custom-marker:hover {
  transform: scale(1.2);
}

.drone-marker {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
```

---

## 10. FLOW DIAGRAM

### Tổng Quan End-to-End

```
┌──────────────────────────────────────────────────────────────────┐
│                         CUSTOMER FLOW                             │
└──────────────────────────────────────────────────────────────────┘

1. Customer mở app → HomePage
   ↓
2. Vào CheckoutPage
   - Chọn địa chỉ giao hàng (có sẵn hoặc thêm mới)
   - Hệ thống geocode địa chỉ → lấy lat/lng
   - Gợi ý nhà hàng gần nhất dựa trên lat/lng
   ↓
3. Chọn nhà hàng → Thêm món vào giỏ → Checkout
   ↓
4. Tạo order (với delivery lat/lng)
   ↓
5. Payment flow (VNPay)
   ↓
6. Order confirmed → Restaurant nhận order


┌──────────────────────────────────────────────────────────────────┐
│                        RESTAURANT FLOW                            │
└──────────────────────────────────────────────────────────────────┘

7. Merchant (restaurant-merchant app) nhận thông báo order mới
   ↓
8. Xác nhận order → Status: PREPARING
   ↓
9. Chuẩn bị món ăn xong
   ↓
10. Click "Sẵn sàng - Gọi drone" → Status: READY_FOR_PICKUP
    - Backend publish Kafka event: ORDER_READY_FOR_PICKUP
    - Payload chứa: restaurant lat/lng, customer lat/lng, order info


┌──────────────────────────────────────────────────────────────────┐
│                          DRONE FLOW                               │
└──────────────────────────────────────────────────────────────────┘

11. drone-service consumer nhận event ORDER_READY_FOR_PICKUP
    - Tính khoảng cách restaurant → customer
    - Query drone gần nhà hàng nhất (WHERE status=AVAILABLE)
    - Create Delivery record (status: PENDING)
    - Publish event: DELIVERY_CREATED
    ↓
12. socket-service emit realtime:
    - dispatch:delivery:created → room 'dispatch' (Admin dashboard)
    - order:ready:confirmed → room restaurant:{storeId}


┌──────────────────────────────────────────────────────────────────┐
│                          ADMIN FLOW                               │
└──────────────────────────────────────────────────────────────────┘

13. Admin mở DispatchQueuePage
    - Nhận real-time notification
    - Hiển thị danh sách delivery chờ gán drone
    ↓
14. Click vào delivery → OrderDetailPage (Delivery Mode)
    - Hiển thị MAP với:
      + Restaurant marker
      + Customer marker
      + Route giữa 2 điểm
      + Nearby drones (markers trên map)
    - Sidebar: Danh sách drone gần nhất
      + Tên, model, pin, khoảng cách đến restaurant
    ↓
15. Admin chọn drone → Call API assign-drone
    - Update delivery: status=ASSIGNED, droneId=xxx
    - Update drone: status=IN_USE
    - Publish event: DRONE_ASSIGNED
    - socket-service emit:
      + drone:assigned → room order:{orderId}
      + delivery:updated → room dispatch
    ↓
16. Navigate to RouteTrackingPage
    - Real-time map tracking
    - Drone di chuyển: restaurant → customer
    - Socket updates vị trí drone mỗi 5s
    - Animate drone marker trên map


┌──────────────────────────────────────────────────────────────────┐
│                      REAL-TIME TRACKING                           │
└──────────────────────────────────────────────────────────────────┘

17. Drone Simulator (hoặc real device):
    - Mỗi 5s: Tính vị trí mới dựa trên route
    - PUT /api/drones/{id}/location (lat, lng, battery, speed)
    - drone-service:
      + Update drone.currentLat/Lng
      + Create TrackingPoint record
      + Publish: DRONE_LOCATION_UPDATED
    - socket-service emit:
      + drone:location:update → room order:{orderId}
    ↓
18. Admin & Customer cùng nhận updates:
    - Frontend animate drone marker từ vị trí cũ → mới
    - Cập nhật ETA, distance remaining
    - Update battery, speed info
    ↓
19. Status transitions:
    - ASSIGNED → PICKING_UP (drone đến restaurant)
    - PICKING_UP → IN_TRANSIT (đã lấy món, đang giao)
    - IN_TRANSIT → ARRIVED (đến địa chỉ customer)
    - ARRIVED → DELIVERED (giao xong)
    ↓
20. Delivery completed:
    - Update order status: DELIVERED
    - Update drone: status=AVAILABLE, currentLat/Lng = customer location
    - Notification cho customer
    - Admin dashboard update statistics


┌──────────────────────────────────────────────────────────────────┐
│                      DATA FLOW SUMMARY                            │
└──────────────────────────────────────────────────────────────────┘

Services Involved:
1. location-service: Geocoding, distance calculation
2. user-service: Manage user addresses
3. restaurant-service: Store locations, order ready event
4. order-service: Create orders with delivery coordinates
5. drone-service: Manage drones, deliveries, tracking
6. socket-service: Real-time updates
7. api-gateway: Route requests

External APIs:
- OpenStreetMap Nominatim (geocoding)
- Mapbox GL JS (map display)
- Mapbox Directions API (route calculation)

Database:
- PostgreSQL với PostGIS extension (spatial queries)
- Indexes trên latitude/longitude columns
- TrackingPoint records cho historical data
```

---

## 11. IMPLEMENTATION CHECKLIST

### Phase 1: Location Foundation (Week 1)
- [ ] Setup location-service với Nominatim integration
- [ ] Implement geocoding/reverse geocoding APIs
- [ ] Add PostGIS extension cho PostgreSQL
- [ ] Thêm indexes cho latitude/longitude columns
- [ ] Test distance calculation queries

### Phase 2: User Address Management (Week 1)
- [ ] Frontend: AddressSelector component
- [ ] Frontend: AddressForm component
- [ ] API: CRUD operations cho addresses
- [ ] Integration: Geocode address khi user thêm mới
- [ ] UI: Hiển thị addresses trong CheckoutPage

### Phase 3: Restaurant Location (Week 2)
- [ ] API: GET /stores/nearby với spatial query
- [ ] Frontend: NearbyRestaurants component
- [ ] Integration: Gọi API khi user chọn địa chỉ
- [ ] UI: Hiển thị distance, sort by proximity
- [ ] Update order creation với delivery coordinates

### Phase 4: Drone Assignment (Week 2-3)
- [ ] API: GET /drones/nearby
- [ ] Kafka consumer: ORDER_READY_FOR_PICKUP → create Delivery
- [ ] API: POST /deliveries/{id}/assign-drone
- [ ] Frontend (admin): DispatchQueuePage with real-time updates
- [ ] Frontend (admin): OrderDetailPage với map preview
- [ ] Socket events: delivery:created, drone:assigned

### Phase 5: Map Integration (Week 3)
- [ ] Setup Mapbox account & token
- [ ] Component: DeliveryMap.tsx (base map với markers)
- [ ] Component: RouteTrackingMap.tsx (animated tracking)
- [ ] API: Integrate Mapbox Directions API
- [ ] Custom markers: restaurant, customer, drone
- [ ] Route drawing với Mapbox GL JS

### Phase 6: Real-time Tracking (Week 4)
- [ ] Drone Simulator: Calculate next position based on route
- [ ] API: PUT /drones/{id}/location (update position)
- [ ] TrackingPoint creation trong drone-service
- [ ] Socket events: drone:location:update
- [ ] Frontend: Animate drone marker
- [ ] Frontend: Update ETA, distance, battery realtime

### Phase 7: Customer Tracking (Week 4)
- [ ] Frontend (customer): OrderTrackingPage
- [ ] Socket connection: join room order:{orderId}
- [ ] Map display tương tự admin nhưng read-only
- [ ] Push notifications cho status changes
- [ ] UI: Bottom sheet với order info & ETA

### Phase 8: Testing & Polish (Week 5)
- [ ] End-to-end testing: Customer → Restaurant → Drone → Delivery
- [ ] Performance: Optimize spatial queries với indexes
- [ ] Error handling: Không có drone available
- [ ] Edge cases: Customer/restaurant address không có lat/lng
- [ ] UI/UX polish: Loading states, animations, error messages
- [ ] Documentation: API docs, deployment guide

---

## 12. NOTES & BEST PRACTICES

### 🎯 Performance Optimization
1. **Spatial Indexes**: Bắt buộc có index (latitude, longitude) cho queries nhanh
2. **Caching**: Cache danh sách tỉnh/quận/phường (ít thay đổi)
3. **Throttling**: Giới hạn socket updates (5s/update) để tránh spam
4. **Pagination**: Nearby queries nên limit kết quả (top 10-20)

### 🔒 Security
1. **API Keys**: Không hardcode Mapbox token, dùng environment variables
2. **Authentication**: Protect drone assignment APIs (chỉ SYSTEM_ADMIN)
3. **Validation**: Validate lat/lng values (-90 to 90, -180 to 180)
4. **Rate Limiting**: Limit geocoding requests (tránh abuse Nominatim)

### 📊 Monitoring
1. **Metrics**: Track số lượng deliveries per hour
2. **Drone Utilization**: % thời gian IN_USE vs AVAILABLE
3. **Average Delivery Time**: Từ ASSIGNED → DELIVERED
4. **Failed Deliveries**: Reasons, frequency

### 🚀 Future Enhancements
1. **Multi-drone routing**: Tối ưu multiple deliveries cho 1 drone
2. **Predictive Dispatch**: ML model dự đoán nhu cầu, pre-position drones
3. **Weather Integration**: Adjust routes dựa trên thời tiết
4. **Battery Optimization**: Calculate route dựa trên battery level
5. **Customer Preferences**: Cho phép customer chọn thời gian giao
6. **Drone Heatmap**: Visualize drone density trên map

---

## 13. KẾT LUẬN

Workflow này tích hợp đầy đủ các tính năng location-based và real-time tracking vào hệ thống hiện tại mà không phá vỡ cấu trúc microservices. 

**Key Points:**
✅ Tận dụng services có sẵn (user, restaurant, drone, socket)  
✅ Thêm location-service mới cho geocoding & spatial queries  
✅ Sử dụng Mapbox cho map visualization (free tier đủ dùng)  
✅ Real-time updates qua Socket.IO & Kafka  
✅ Scalable: PostGIS cho spatial queries hiệu quả  
✅ User-friendly: Tự động gợi ý nhà hàng & drone gần nhất  

**Tech Stack Summary:**
- Backend: Node.js, Express, Prisma, PostgreSQL + PostGIS
- Real-time: Socket.IO, Kafka
- Geocoding: OpenStreetMap Nominatim (free)
- Maps: Mapbox GL JS
- Frontend: React, TypeScript, TailwindCSS

Chúc bạn implement thành công! 🚀

