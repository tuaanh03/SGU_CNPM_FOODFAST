# K6 Customer Load Test - Workflow Documentation

**File:** `backend/services/user-service/simulate/load-test/k6-customer.js`  
**Ngày cập nhật:** 26/11/2025  
**Mục đích:** Load testing cho Customer Journey với location-aware features

---

## 📋 Tổng quan Workflow

File k6-customer.js mô phỏng hành vi thực tế của khách hàng từ khi đăng ký đến khi hoàn thành các thao tác browse và quản lý địa chỉ.

### 🎯 Customer Journey Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   CUSTOMER JOURNEY                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  1. Register New Customer        │
        │  POST /api/auth/customer/register│
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  2. Login Customer               │
        │  POST /api/auth/customer/login   │
        │  → Lấy JWT Token                 │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  3. Verify Token                 │
        │  POST /api/auth/verify-token     │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  4. Get Profile                  │
        │  GET /api/auth/profile           │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  5. Create Address (70% users)   │
        │  ├─ 5a. Geocode Address          │
        │  │   POST /api/locations/geocode │
        │  │   → Lấy latitude/longitude    │
        │  └─ 5b. Create Address           │
        │      POST /api/addresses         │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  6. Get Addresses                │
        │  GET /api/addresses              │
        └──────────────────────────────────┘
                           │
                           ▼
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
   ┌─────────────────────┐   ┌─────────────────────┐
   │ 7. Browse Nearby    │   │ 8. Browse All       │
   │    Stores (Có tọa độ)│   │    Stores (Không có)│
   │ GET /api/stores/    │   │ GET /api/stores     │
   │     nearby          │   │                     │
   │ • lat/lng + radius  │   │ • Xem tất cả stores │
   │ • Xem 1-2 stores    │   │ • Xem 2-3 stores    │
   │   gần nhất          │   │   ngẫu nhiên        │
   │ • Xem menu          │   │ • Xem menu          │
   └─────────────────────┘   └─────────────────────┘
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  9. Create Order (50% users,     │
        │     chỉ có tọa độ)               │
        │  ├─ 9a. Browse Nearby Stores     │
        │  ├─ 9b. View Menu                │
        │  ├─ 9c. Add to Cart (1-3 items)  │
        │  │   POST /api/cart/items        │
        │  ├─ 9d. View Cart                │
        │  │   GET /api/cart               │
        │  ├─ 9e. Get Address ID           │
        │  ├─ 9f. Create Order             │
        │  │   POST /api/order/create-     │
        │  │        from-cart               │
        │  └─ 9g. Get Order Details        │
        │      GET /api/order/{orderId}    │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  10. Update Profile (30% users)  │
        │  PUT /api/auth/profile           │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  11. Logout (50% users)          │
        │  POST /api/auth/logout           │
        └──────────────────────────────────┘
```

---

## 🔄 Chi tiết từng bước Workflow

### Step 1: Register New Customer

**API Endpoint:** `POST /api/auth/customer/register`

**Request Body:**
```json
{
  "email": "customer1_1732612345_7890@loadtest.com",
  "password": "Test@123456",
  "name": "Nguyễn Văn A"
}
```

**Metrics tracked:**
- `register_duration_ms` - Thời gian xử lý đăng ký
- `register_success` - Tỉ lệ đăng ký thành công

**Success criteria:**
- Status: 200 hoặc 201
- Response có `success: true` hoặc `data` hoặc `token`

**Think time:** 1-3 giây (giả lập user đọc email confirmation)

---

### Step 2: Login Customer

**API Endpoint:** `POST /api/auth/customer/login`

**Request Body:**
```json
{
  "email": "customer1_1732612345_7890@loadtest.com",
  "password": "Test@123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-123",
      "email": "customer1@loadtest.com",
      "role": "CUSTOMER"
    }
  }
}
```

**Metrics tracked:**
- `login_duration_ms` - Thời gian xử lý login
- `login_success` - Tỉ lệ login thành công

**Success criteria:**
- Status: 200
- Response có `token` hoặc `accessToken`

**Think time:** 0.5-2 giây

**Data extraction:**
- Lưu `token` vào biến `userToken` để dùng cho các request tiếp theo

---

### Step 3: Verify Token

**API Endpoint:** `POST /api/auth/verify-token`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Metrics tracked:**
- `verify_token_duration_ms`
- `verify_token_success`

**Success criteria:**
- Status: 200
- Response có `valid: true` hoặc `user`

**Think time:** 0.2-1 giây

---

### Step 4: Get Profile

**API Endpoint:** `GET /api/auth/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "email": "customer1@loadtest.com",
    "name": "Nguyễn Văn A",
    "role": "CUSTOMER",
    "createdAt": "2025-11-26T10:30:00Z"
  }
}
```

**Metrics tracked:**
- `profile_duration_ms`
- `profile_success`

**Success criteria:**
- Status: 200
- Response có `user` hoặc `data`

**Think time:** 1-3 giây

---

### Step 5: Create Address with Geocoding (70% users)

**Điều kiện:** `Math.random() < 0.7` (70% users thực hiện)

#### Step 5a: Geocode Address

**API Endpoint:** `POST /api/locations/geocode`

**Request Body:**
```json
{
  "address": "123 Nguyễn Trãi",
  "ward": "Phường Bến Thành",
  "district": "Quận 1",
  "province": "Thành phố Hồ Chí Minh"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "latitude": 10.762622,
    "longitude": 106.660172,
    "formattedAddress": "123 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP.HCM"
  }
}
```

**Metrics tracked:**
- `geocode_address_duration_ms`
- `geocode_success`

**Success criteria:**
- Status: 200
- Response có `latitude` và `longitude`

**Data extraction:**
- Lưu tọa độ vào biến `userCoordinates = { latitude, longitude }`

**Think time:** 0.5-1 giây

#### Step 5b: Create Address

**API Endpoint:** `POST /api/addresses`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "street": "123 Nguyễn Trãi",
  "ward": "Phường Bến Thành",
  "district": "Quận 1",
  "province": "Thành phố Hồ Chí Minh",
  "latitude": 10.762622,
  "longitude": 106.660172,
  "isDefault": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "addr-123",
    "street": "123 Nguyễn Trãi",
    "latitude": 10.762622,
    "longitude": 106.660172,
    "isDefault": true
  }
}
```

**Metrics tracked:**
- `create_address_duration_ms`
- `create_address_success`

**Success criteria:**
- Status: 200 hoặc 201
- Response có `id` hoặc `addressId`

**Think time:** 1-2 giây

---

### Step 6: Get Addresses

**API Endpoint:** `GET /api/addresses`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "addr-123",
      "street": "123 Nguyễn Trãi",
      "ward": "Phường Bến Thành",
      "district": "Quận 1",
      "province": "Thành phố Hồ Chí Minh",
      "latitude": 10.762622,
      "longitude": 106.660172,
      "isDefault": true
    }
  ]
}
```

**Metrics tracked:**
- `get_addresses_duration_ms`
- `get_addresses_success`

**Success criteria:**
- Status: 200
- Response là array

**Think time:** 1-2 giây

---

### Step 7: Browse Nearby Stores (Có tọa độ)

**Điều kiện:** User có `userCoordinates` từ step 5

**API Endpoint:** `GET /api/stores/nearby?lat={lat}&lng={lng}&radius=10&limit=50`

**Example:**
```
GET /api/stores/nearby?lat=10.762622&lng=106.660172&radius=10&limit=50
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "store-1",
      "name": "Nhà hàng ABC",
      "address": "456 Lê Lai, Q1",
      "latitude": 10.765000,
      "longitude": 106.663000,
      "distance": 0.35,
      "isOpen": true
    },
    {
      "id": "store-2",
      "name": "Quán ăn XYZ",
      "distance": 1.2
    }
  ]
}
```

**Metrics tracked:**
- `browse_nearby_stores_duration_ms`
- `browse_nearby_stores_success`

**Success criteria:**
- Status: 200
- Response có array stores
- Stores có `distance` field

**Think time:** 2-5 giây

#### Step 7a: View Menu của 1-2 stores gần nhất

**Loop:** Lặp qua 1-2 stores đầu tiên (gần nhất)

**API Endpoint:** `GET /api/restaurants/{storeId}/menu`

**Response:**
```json
{
  "success": true,
  "data": {
    "store": { "id": "store-1", "name": "Nhà hàng ABC" },
    "products": [
      { "id": "prod-1", "name": "Phở bò", "price": 50000 },
      { "id": "prod-2", "name": "Bún chả", "price": 45000 }
    ]
  }
}
```

**Metrics tracked:**
- `browse_menu_duration_ms`
- `browse_menu_success`

**Think time:** 3-8 giây (giả lập user đọc menu)

---

### Step 8: Browse All Stores (Không có tọa độ)

**Điều kiện:** User KHÔNG có `userCoordinates` (30% users)

**API Endpoint:** `GET /api/stores`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "store-1",
      "name": "Nhà hàng ABC",
      "address": "456 Lê Lai, Q1",
      "isOpen": true
    },
    {
      "id": "store-2",
      "name": "Quán ăn XYZ"
    }
  ]
}
```

**Metrics tracked:**
- `browse_stores_duration_ms`
- `browse_stores_success`

**Think time:** 2-5 giây

#### Step 8a: View Menu của 2-3 stores ngẫu nhiên

**Loop:** Lặp qua 2-3 stores ngẫu nhiên

**API Endpoint:** `GET /api/restaurants/{storeId}/menu`

**Metrics tracked:**
- `browse_menu_duration_ms`
- `browse_menu_success`

**Think time:** 3-8 giây

---

### Step 9: Create Order Flow (50% users - chỉ với users có tọa độ)

**Điều kiện:** 
- `Math.random() < 0.5` (50% users)
- User phải có `userCoordinates` (đã tạo địa chỉ với geocoding thành công)

**Mô tả:** Quy trình hoàn chỉnh từ browse stores → add to cart → create order

#### Step 9a: Browse Nearby Stores

**API Endpoint:** `GET /api/stores/nearby?lat={lat}&lng={lng}&radius=10&limit=50`

Tìm nhà hàng gần nhất để tạo đơn hàng.

**Think time:** 1-2 giây

---

#### Step 9b: View Menu

**API Endpoint:** `GET /api/restaurants/{storeId}/menu`

Xem menu của nhà hàng đã chọn để lấy danh sách products.

**Think time:** 2-4 giây

---

#### Step 9c: Add Products to Cart (1-3 items)

**API Endpoint:** `POST /api/cart/items`

**Request Body:**
```json
{
  "storeId": "store-123",
  "productId": "prod-456",
  "quantity": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cartItemId": "cart-item-789",
    "storeId": "store-123",
    "productId": "prod-456",
    "quantity": 2
  }
}
```

**Logic:**
- Random 1-3 products từ menu
- Mỗi product có quantity random 1-2

**Metrics tracked:**
- `add_to_cart_duration_ms`
- `add_to_cart_success`

**Success criteria:**
- Status: 200 hoặc 201
- Response có data/cartItemId

**Think time:** 1-2 giây (sau mỗi lần add)

---

#### Step 9d: View Cart

**API Endpoint:** `GET /api/cart`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cart-123",
    "userId": "user-456",
    "items": [
      {
        "id": "cart-item-789",
        "productId": "prod-456",
        "productName": "Phở bò",
        "price": 50000,
        "quantity": 2,
        "subtotal": 100000
      }
    ],
    "totalAmount": 100000
  }
}
```

**Metrics tracked:**
- `get_cart_duration_ms`
- `get_cart_success`

**Success criteria:**
- Status: 200
- Response có cart data

**Think time:** 2-3 giây

---

#### Step 9e: Get Address ID

**API Endpoint:** `GET /api/addresses`

Lấy addressId để dùng cho đơn hàng:
- Ưu tiên địa chỉ mặc định (`isDefault: true`)
- Nếu không có default, dùng địa chỉ đầu tiên

**Think time:** 1-2 giây

---

#### Step 9f: Create Order from Cart

**API Endpoint:** `POST /api/order/create-from-cart`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "addressId": "addr-123",
  "note": "Load test order from VU 5"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order-789",
    "totalAmount": 100000,
    "status": "PENDING",
    "deliveryAddress": {
      "street": "123 Nguyễn Trãi",
      "ward": "Phường Bến Thành",
      "district": "Quận 1",
      "province": "TP.HCM"
    },
    "createdAt": "2025-11-26T10:30:00Z"
  }
}
```

**Metrics tracked:**
- `create_order_duration_ms`
- `create_order_success`

**Success criteria:**
- Status: 200 hoặc 201
- Response có `orderId`

**Think time:** 2-3 giây

---

#### Step 9g: Get Order Details

**API Endpoint:** `GET /api/order/{orderId}`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order-789",
    "orderId": "order-789",
    "userId": "user-456",
    "storeId": "store-123",
    "storeName": "Nhà hàng ABC",
    "totalAmount": 100000,
    "status": "PENDING",
    "items": [
      {
        "productName": "Phở bò",
        "quantity": 2,
        "price": 50000
      }
    ],
    "deliveryAddress": {
      "street": "123 Nguyễn Trãi",
      "latitude": 10.762622,
      "longitude": 106.660172
    },
    "createdAt": "2025-11-26T10:30:00Z"
  }
}
```

**Metrics tracked:**
- `get_order_duration_ms`
- `get_order_success`

**Success criteria:**
- Status: 200
- Response có order data

**Think time:** 2-4 giây

---

### Step 10: Update Profile (30% users)

**Điều kiện:** `Math.random() < 0.3` (30% users)

**API Endpoint:** `PUT /api/auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Nguyễn Văn A (Updated)"
}
```

**Metrics tracked:**
- `update_profile_duration_ms`
- (Không track success rate riêng, dùng chung `profile_success`)

**Success criteria:**
- Status: 200

**Think time:** 1-2 giây

---

### Step 11: Logout (50% users)

**Điều kiện:** `Math.random() < 0.5` (50% users)

**API Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <token>
```

**Metrics tracked:**
- `logout_duration_ms`
- `logout_success`

**Success criteria:**
- Status: 200

**Final think time:** 2-5 giây

---

## 📊 Custom Metrics

### Trend Metrics (Đo thời gian phản hồi)

| Metric Name | Mô tả |
|------------|-------|
| `register_duration_ms` | Thời gian xử lý đăng ký (ms) |
| `login_duration_ms` | Thời gian xử lý login (ms) |
| `verify_token_duration_ms` | Thời gian verify token (ms) |
| `profile_duration_ms` | Thời gian get profile (ms) |
| `update_profile_duration_ms` | Thời gian update profile (ms) |
| `create_address_duration_ms` | Thời gian tạo địa chỉ (ms) |
| `get_addresses_duration_ms` | Thời gian get addresses (ms) |
| `geocode_address_duration_ms` | Thời gian geocode (ms) |
| `browse_nearby_stores_duration_ms` | Thời gian browse nearby (ms) |
| `browse_stores_duration_ms` | Thời gian browse all stores (ms) |
| `browse_menu_duration_ms` | Thời gian browse menu (ms) |
| **`add_to_cart_duration_ms`** | **Thời gian thêm vào giỏ hàng (ms)** |
| **`get_cart_duration_ms`** | **Thời gian xem giỏ hàng (ms)** |
| **`create_order_duration_ms`** | **Thời gian tạo đơn hàng (ms)** |
| **`get_order_duration_ms`** | **Thời gian xem đơn hàng (ms)** |
| `logout_duration_ms` | Thời gian logout (ms) |

### Rate Metrics (Tỉ lệ thành công)

| Metric Name | Mô tả | Target |
|------------|-------|--------|
| `register_success` | Tỉ lệ đăng ký thành công | > 90% |
| `login_success` | Tỉ lệ login thành công | > 95% |
| `verify_token_success` | Tỉ lệ verify thành công | > 95% |
| `profile_success` | Tỉ lệ get profile thành công | > 95% |
| `create_address_success` | Tỉ lệ tạo địa chỉ thành công | > 90% |
| `get_addresses_success` | Tỉ lệ get addresses thành công | > 95% |
| `geocode_success` | Tỉ lệ geocode thành công | > 90% |
| `browse_nearby_stores_success` | Tỉ lệ browse nearby thành công | > 90% |
| `browse_stores_success` | Tỉ lệ browse stores thành công | > 95% |
| `browse_menu_success` | Tỉ lệ browse menu thành công | > 90% |
| **`add_to_cart_success`** | **Tỉ lệ thêm vào giỏ hàng thành công** | **> 90%** |
| **`get_cart_success`** | **Tỉ lệ xem giỏ hàng thành công** | **> 95%** |
| **`create_order_success`** | **Tỉ lệ tạo đơn hàng thành công** | **> 85%** |
| **`get_order_success`** | **Tỉ lệ xem đơn hàng thành công** | **> 95%** |
| `logout_success` | Tỉ lệ logout thành công | > 95% |

### Counter Metrics

| Metric Name | Mô tả |
|------------|-------|
| `total_requests` | Tổng số HTTP requests đã gửi |

---

## ⚙️ Test Configuration

### Load Stages

```javascript
stages: [
    { duration: '30s', target: 10 },   // Warm up: 10 users
    { duration: '1m', target: 50 },    // Ramp up: 50 users
    { duration: '2m', target: 100 },   // Normal load: 100 users
    { duration: '3m', target: 200 },   // Peak load: 200 users
    { duration: '2m', target: 100 },   // Scale down: 100 users
    { duration: '1m', target: 0 },     // Cool down: 0 users
]
```

**Tổng thời gian test:** ~9 phút

### Thresholds (Performance Targets)

```javascript
thresholds: {
    // HTTP thresholds
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],  // 95% < 3s, 99% < 5s
    http_req_failed: ['rate<0.05'],                   // < 5% failures
    
    // Success rate thresholds
    register_success: ['rate>0.90'],                  // > 90% success
    login_success: ['rate>0.95'],                     // > 95% success
    verify_token_success: ['rate>0.95'],              // > 95% success
    profile_success: ['rate>0.95'],                   // > 95% success
    create_address_success: ['rate>0.90'],            // > 90% success
    get_addresses_success: ['rate>0.95'],             // > 95% success
    geocode_success: ['rate>0.90'],                   // > 90% (external API)
    browse_nearby_stores_success: ['rate>0.90'],      // > 90% success
    browse_stores_success: ['rate>0.95'],             // > 95% success
    browse_menu_success: ['rate>0.90'],               // > 90% success
    add_to_cart_success: ['rate>0.90'],               // > 90% success
    get_cart_success: ['rate>0.95'],                  // > 95% success
    create_order_success: ['rate>0.85'],              // > 85% success
    get_order_success: ['rate>0.95'],                 // > 95% success
}
```

### Environment Variables

| Variable | Mô tả | Default |
|----------|-------|---------|
| `K6_BASE_URL` | Base URL của API Gateway | `http://localhost:3000` |
| `K6_USER_PASS` | Password cho test users | `Test@123456` |
| `K6_RESTAURANT_ID` | Restaurant ID fallback | `539960cc-8d53-49ff-9be0-b5a493d78f65` |

---

## 🎲 Realistic User Behavior

### Randomization

1. **Email generation:**
   - Format: `customer{VU}_{timestamp}_{random}@loadtest.com`
   - Unique cho mỗi virtual user

2. **Name generation:**
   - Random từ danh sách tên Việt Nam
   - VD: "Nguyễn Văn A", "Trần Thị B", "Lê Minh C"

3. **Address generation:**
   - Random street từ danh sách đường phố TP.HCM
   - Random ward, district
   - Province: "Thành phố Hồ Chí Minh"

4. **Think time:**
   - Giả lập thời gian suy nghĩ của user thật
   - Random giữa min-max giây
   - Ví dụ: `thinkTime(1, 3)` → 1-3 giây random

5. **Conditional flows:**
   - 70% users tạo địa chỉ
   - 30% users update profile
   - 50% users logout

### Store Selection Logic

**Có tọa độ (70% users):**
- Tìm stores trong bán kính 10km
- Xem menu của 1-2 stores GẦN NHẤT
- Ưu tiên stores có `distance` nhỏ

**Không có tọa độ (30% users):**
- Browse all stores
- Xem menu của 2-3 stores NGẪU NHIÊN

---

## 🚀 Cách chạy K6 Test

### Basic Run (Local)

```bash
k6 run backend/services/user-service/simulate/load-test/k6-customer.js
```

### Custom Base URL (Production)

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run backend/services/user-service/simulate/load-test/k6-customer.js
```

---

## 🎛️ Thay đổi số VUs và Duration

### **Cách 1: Override bằng Command Line Flags (Khuyến nghị)**

#### Fixed VUs với Duration đơn giản

```bash
# Smoke test: 5 VUs trong 2 phút
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --vus 5 --duration 2m backend/services/user-service/simulate/load-test/k6-customer.js

# Load test: 50 VUs trong 5 phút
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --vus 50 --duration 5m backend/services/user-service/simulate/load-test/k6-customer.js

# Stress test: 200 VUs trong 10 phút
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --vus 200 --duration 10m backend/services/user-service/simulate/load-test/k6-customer.js
```

#### Custom Stages (Ramping VUs)

```bash
# Smoke test với ramp-up (0→5→0)
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --stage 30s:5,1m:5,30s:0 backend/services/user-service/simulate/load-test/k6-customer.js

# Load test với ramp-up (0→10→50→0)
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --stage 1m:10,2m:50,3m:50,1m:0 backend/services/user-service/simulate/load-test/k6-customer.js

# Stress test với ramp-up (0→50→100→200→0)
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --stage 1m:50,2m:100,3m:200,2m:100,1m:0 backend/services/user-service/simulate/load-test/k6-customer.js

# Spike test: Tăng đột ngột lên 500 VUs
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --stage 10s:0,30s:500,1m:500,30s:0 backend/services/user-service/simulate/load-test/k6-customer.js
```

**Format stages:** `--stage <duration>:<target_vus>`
- `1m:50` = Ramp up/down đến 50 VUs trong 1 phút
- Multiple stages: `--stage 1m:10,2m:50,1m:0`

---

### **Cách 2: Override bằng Environment Variables**

```bash
# Smoke test
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
K6_VUS=5 \
K6_DURATION=2m \
k6 run backend/services/user-service/simulate/load-test/k6-customer.js

# Load test
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
K6_VUS=100 \
K6_DURATION=10m \
k6 run backend/services/user-service/simulate/load-test/k6-customer.js
```

**Lưu ý:** Environment variables chỉ work nếu file k6 được config để đọc chúng:
```javascript
export let options = {
    vus: __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : 10,
    duration: __ENV.K6_DURATION || '5m',
};
```

---

### **Cách 3: Tạo Config File riêng**

Tạo file `k6-config-smoke.json`:
```json
{
  "stages": [
    { "duration": "30s", "target": 5 },
    { "duration": "1m", "target": 5 },
    { "duration": "30s", "target": 0 }
  ]
}
```

Chạy với config:
```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --config k6-config-smoke.json backend/services/user-service/simulate/load-test/k6-customer.js
```

---

## 📊 Test Scenarios Recommended

### 1. Smoke Test (Kiểm tra cơ bản)

**Mục đích:** Verify script chạy được, không có lỗi cơ bản

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --vus 2 --duration 1m backend/services/user-service/simulate/load-test/k6-customer.js
```

**Expected:**
- 2 VUs trong 1 phút
- ~10-20 iterations
- 0% error rate
- Quick validation

---

### 2. Load Test (Test tải bình thường)

**Mục đích:** Test ở mức tải dự kiến hàng ngày

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --stage 1m:20,3m:50,2m:50,1m:0 backend/services/user-service/simulate/load-test/k6-customer.js
```

**Expected:**
- Ramp up đến 50 VUs
- Duration: ~7 phút
- Error rate < 5%
- p95 latency < 1s

---

### 3. Stress Test (Test giới hạn)

**Mục đích:** Tìm breaking point của hệ thống

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --stage 2m:50,3m:100,3m:150,3m:200,2m:100,1m:0 backend/services/user-service/simulate/load-test/k6-customer.js
```

**Expected:**
- Tăng dần lên 200 VUs
- Duration: ~14 phút
- Quan sát khi nào hệ thống bắt đầu fail

---

### 4. Spike Test (Test tăng đột ngột)

**Mục đích:** Test khả năng chống chịu traffic đột biến (flash sale, viral post)

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --stage 30s:10,10s:500,2m:500,30s:10 backend/services/user-service/simulate/load-test/k6-customer.js
```

**Expected:**
- 10 VUs → 500 VUs trong 10 giây (spike)
- Maintain 500 VUs trong 2 phút
- Scale down về 10 VUs
- Hệ thống có recover được không?

---

### 5. Soak Test / Endurance Test (Test độ bền)

**Mục đích:** Test memory leaks, stability trong thời gian dài

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --vus 50 --duration 1h backend/services/user-service/simulate/load-test/k6-customer.js
```

**Expected:**
- 50 VUs constant trong 1 giờ
- Monitor memory usage trends
- Phát hiện memory leaks

---

## 🔧 Advanced Options

### Combine với Thresholds Custom

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run \
  --vus 100 \
  --duration 5m \
  --summary-trend-stats="min,avg,med,p(90),p(95),p(99),max" \
  --no-usage-report \
  backend/services/user-service/simulate/load-test/k6-customer.js
```

### Export Results Multiple Formats

```bash
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run \
  --vus 50 \
  --duration 5m \
  --out json=results.json \
  --out csv=results.csv \
  --summary-export=summary.json \
  backend/services/user-service/simulate/load-test/k6-customer.js
```

### Run with Custom Password

```bash
K6_BASE_URL=https://api.example.com \
K6_USER_PASS=MySecurePass@123 \
k6 run --vus 20 --duration 3m backend/services/user-service/simulate/load-test/k6-customer.js
```

### Export to Grafana Cloud

```bash
K6_CLOUD_TOKEN=your_token \
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run --out cloud --vus 100 --duration 10m backend/services/user-service/simulate/load-test/k6-customer.js
```

---

## 💡 Tips & Best Practices

### 1. Chọn số VUs phù hợp

```bash
# Development/Staging: 5-20 VUs
K6_BASE_URL=https://staging-api.example.com \
k6 run --vus 10 --duration 3m <script>

# Production (off-peak): 50-100 VUs
K6_BASE_URL=https://api.example.com \
k6 run --vus 50 --duration 5m <script>

# Production (peak simulation): 200-500 VUs
K6_BASE_URL=https://api.example.com \
k6 run --stage 2m:100,5m:500,2m:100 <script>
```

### 2. Luôn dùng ramp-up/down

❌ **Không nên:**
```bash
k6 run --vus 500 --duration 5m <script>
```
→ Shock hệ thống, không realistic

✅ **Nên:**
```bash
k6 run --stage 1m:100,2m:500,5m:500,1m:100,30s:0 <script>
```
→ Ramp up từ từ, maintain, ramp down

### 3. Monitor trong khi test

```bash
# Terminal 1: Chạy k6
K6_BASE_URL=https://api.example.com \
k6 run --vus 100 --duration 10m <script>

# Terminal 2: Monitor logs
kubectl logs -f deployment/user-service --tail=100

# Browser: Mở Grafana dashboard
# Quan sát CPU, Memory, Response time, Error rate
```

### 4. Start small, ramp up

```bash
# Step 1: Smoke test
k6 run --vus 2 --duration 1m <script>

# Step 2: Small load
k6 run --vus 10 --duration 2m <script>

# Step 3: Medium load
k6 run --vus 50 --duration 5m <script>

# Step 4: Full load
k6 run --stage 2m:50,5m:200,2m:50 <script>
```

---

## 📋 Quick Reference Commands

```bash
# Smoke test (2 phút)
K6_BASE_URL=<url> k6 run --vus 5 --duration 2m <script>

# Load test (5 phút)
K6_BASE_URL=<url> k6 run --vus 50 --duration 5m <script>

# Stress test (10 phút)
K6_BASE_URL=<url> k6 run --stage 2m:50,5m:200,3m:0 <script>

# Spike test
K6_BASE_URL=<url> k6 run --stage 10s:10,30s:500,1m:500,30s:0 <script>

# Endurance test (1 giờ)
K6_BASE_URL=<url> k6 run --vus 50 --duration 1h <script>
```

---

## 🎯 Real-World Example

```bash
# Test production API với ramp-up realistic
K6_BASE_URL=https://api-gateway-service-production-04a1.up.railway.app \
k6 run \
  --stage 30s:10 \
  --stage 1m:50 \
  --stage 2m:100 \
  --stage 5m:200 \
  --stage 2m:100 \
  --stage 1m:0 \
  --out json=results.json \
  --summary-export=summary.json \
  backend/services/user-service/simulate/load-test/k6-customer.js
```

**Giải thích stages:**
- `30s:10` - Warm up: 0 → 10 VUs trong 30s
- `1m:50` - Ramp up: 10 → 50 VUs trong 1m
- `2m:100` - Continue ramp: 50 → 100 VUs trong 2m
- `5m:200` - Peak load: 100 → 200 VUs, maintain trong 5m
- `2m:100` - Scale down: 200 → 100 VUs trong 2m
- `1m:0` - Cool down: 100 → 0 VUs trong 1m

**Total duration:** ~11.5 phút

---

## 📈 Kết quả Test

### Output Mẫu

```
     ✓ register status ok
     ✓ login status ok
     ✓ verify token ok
     ✓ profile status ok

     checks.........................: 98.50% ✓ 1970      ✗ 30
     data_received..................: 15 MB  28 kB/s
     data_sent......................: 8.5 MB 16 kB/s
     http_req_blocked...............: avg=1.2ms   min=0s     med=1ms    max=50ms   p(95)=3ms    p(99)=10ms
     http_req_connecting............: avg=0.8ms   min=0s     med=0.5ms  max=30ms   p(95)=2ms    p(99)=8ms
     http_req_duration..............: avg=250ms   min=50ms   med=200ms  max=2s     p(95)=800ms  p(99)=1.5s
     http_req_failed................: 1.50%  ✓ 30        ✗ 1970
     http_req_receiving.............: avg=0.5ms   min=0s     med=0.3ms  max=20ms   p(95)=2ms    p(99)=5ms
     http_req_sending...............: avg=0.2ms   min=0s     med=0.1ms  max=10ms   p(95)=0.5ms  p(99)=2ms
     http_req_tls_handshaking.......: avg=0ms     min=0s     med=0ms    max=0ms    p(95)=0ms    p(99)=0ms
     http_req_waiting...............: avg=249ms   min=49ms   med=199ms  max=1.9s   p(95)=799ms  p(99)=1.4s
     http_reqs......................: 2000   3.7/s
     iteration_duration.............: avg=45s     min=30s    med=43s    max=60s    p(95)=55s    p(99)=58s
     iterations.....................: 200    0.37/s
     vus............................: 0      min=0       max=200
     vus_max........................: 200    min=200     max=200

     ✓ register_success.............: 92.00% ✓ 184       ✗ 16
     ✓ login_success................: 96.50% ✓ 193       ✗ 7
     ✓ verify_token_success.........: 97.00% ✓ 194       ✗ 6
     ✓ profile_success..............: 98.00% ✓ 196       ✗ 4
     ✓ create_address_success.......: 91.43% ✓ 128       ✗ 12
     ✓ get_addresses_success........: 96.43% ✓ 135       ✗ 5
     ✓ geocode_success..............: 92.14% ✓ 129       ✗ 11
     ✓ browse_nearby_stores_success.: 93.57% ✓ 131       ✗ 9
     ✓ browse_stores_success........: 97.14% ✓ 68        ✗ 2
     ✓ browse_menu_success..........: 95.00% ✓ 285       ✗ 15

running (09m00.0s), 000/200 VUs, 200 complete and 0 interrupted iterations
default ✓ [======================================] 000/200 VUs  9m0s
```

### Metrics Giải thích

**http_req_duration (Response time):**
- `avg`: Trung bình - 250ms ✅
- `p(95)`: 95% requests < 800ms ✅
- `p(99)`: 99% requests < 1.5s ✅
- **Target:** p(95) < 3s, p(99) < 5s

**Success rates:**
- `register_success`: 92% ✅ (target > 90%)
- `login_success`: 96.5% ✅ (target > 95%)
- `geocode_success`: 92.14% ✅ (target > 90% - external API)

**Throughput:**
- `http_reqs`: 2000 requests, 3.7 RPS
- `iterations`: 200 complete user journeys

---

## 🔍 Debugging & Troubleshooting

### Enable Verbose Logging

Uncomment các dòng `console.log` trong file k6:

```javascript
console.log(`[VU ${__VU}] Đăng ký tài khoản: ${userEmail}`);
console.log(`[VU ${__VU}] Đăng nhập thành công, token: ${userToken.substring(0, 20)}...`);
```

### Check Individual Requests

```javascript
// Thêm vào params
const params = {
    tags: { name: 'register_customer' },
};

// Response debugging
console.log(`Response status: ${res.status}`);
console.log(`Response body: ${res.body}`);
```

### Common Issues

**1. High failure rate:**
- Kiểm tra `BASE_URL` đúng chưa
- Service có up không?
- Network timeout?

**2. Geocoding failures:**
- External API (Nominatim) có thể rate limit
- Retry logic cần thiết
- Cache geocoding results

**3. Token expired:**
- JWT token có TTL
- Cần refresh token logic nếu test dài

**4. Address creation failed:**
- Kiểm tra validation rules
- Latitude/longitude đúng format?

---

## 🎯 Best Practices

### 1. Realistic Load Pattern

```javascript
stages: [
    { duration: '30s', target: 10 },   // Warm up - không shock hệ thống
    { duration: '1m', target: 50 },    // Ramp up từ từ
    { duration: '2m', target: 100 },   // Normal load
    { duration: '3m', target: 200 },   // Peak load - test khả năng chịu tải
    { duration: '2m', target: 100 },   // Scale down
    { duration: '1m', target: 0 },     // Cool down - để service recover
]
```

### 2. Think Time

Luôn có think time giữa các requests:
```javascript
thinkTime(1, 3); // 1-3 giây random
```

### 3. Data Cleanup

Không cần cleanup vì:
- Mỗi VU tạo unique email
- Test data có prefix `@loadtest.com`
- Có thể filter và xóa sau

### 4. Incremental Testing

Test theo stages:
1. Smoke test: 1-2 VUs, 1 phút
2. Load test: 10-50 VUs, 5 phút
3. Stress test: 100-200 VUs, 9 phút
4. Spike test: 0 → 500 VUs trong 30s

### 5. Monitor Backend

Trong khi chạy k6, monitor:
- Grafana dashboards
- CPU/Memory usage
- Database connections
- Redis connections
- API Gateway metrics

---

## 📚 Tham khảo

- **K6 Documentation:** https://k6.io/docs/
- **Grafana K6 Integration:** https://k6.io/docs/results-output/real-time/grafana/
- **Performance Testing Best Practices:** https://k6.io/docs/testing-guides/

---

**Lưu ý quan trọng:**
- File k6 này test **customer journey cơ bản** (register → browse stores)
- KHÔNG bao gồm cart/order/payment flow
- Tập trung vào location-aware features (geocoding, nearby stores)
- Realistic user behavior với randomization và conditional flows
- Production-ready với comprehensive metrics tracking

