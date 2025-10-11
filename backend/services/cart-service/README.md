# 🛒 Cart Service - Kiến Trúc Hybrid với Redis

## 📋 Tổng Quan

Cart Service là một microservice quản lý giỏ hàng với kiến trúc hybrid hiện đại, kết hợp:
- **Optimistic UI** ở phía client (Local Storage)
- **Redis** làm nguồn chính thống (source of truth) ở server
- **Session-based cart** - Mỗi user và restaurant có session cart riêng biệt
- **API Gateway Integration** - Client giao tiếp qua port 3000 (API Gateway)

## 🏗️ Kiến Trúc Hybrid

### 1. **Client-Side (Frontend)**
```
┌─────────────────────────────────────┐
│        Optimistic UI Layer          │
│                                     │
│  • Local Storage (Immediate)        │
│  • User thấy update ngay lập tức    │
│  • Không cần đợi server response    │
└─────────────────────────────────────┘
           ↓ (Background sync)
┌─────────────────────────────────────┐
│    API Call to API Gateway          │
│    http://localhost:3000/api/cart   │
└─────────────────────────────────────┘
           ↓ (Proxy)
┌─────────────────────────────────────┐
│         Cart Service (3006)         │
└─────────────────────────────────────┘
```

### 2. **Server-Side (Backend)**
```
┌─────────────────────────────────────┐
│      API Gateway (Port 3000)        │
│  • Proxy /api/cart → cart-service   │
│  • CORS handling                    │
│  • Rate limiting                    │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Cart Service API (Port 3006)      │
│   (Express.js + TypeScript)         │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│      Redis (Source of Truth)        │
│                                     │
│  • Redis Hash cho mỗi cart          │
│  • Key: cart:{userId}:{restaurantId}│
│  • Field: productId                 │
│  • Value: quantity                  │
│  • TTL: 7 ngày (604800s)            │
└─────────────────────────────────────┘
```

## 🗄️ Cấu Trúc Dữ Liệu Redis

### Cart Data (Redis Hash)
```
Key: cart:{userId}:{restaurantId}
Fields:
  - {productId1}: {quantity}
  - {productId2}: {quantity}
  - ...

Example:
cart:user123:restaurant456
  - product789: 2
  - product101: 1
```

### Cart Metadata (Redis Hash)
```
Key: cart:meta:{userId}:{restaurantId}
Fields:
  - createdAt: ISO timestamp
  - updatedAt: ISO timestamp
  - restaurantId: string

Example:
cart:meta:user123:restaurant456
  - createdAt: "2025-10-11T08:00:00.000Z"
  - updatedAt: "2025-10-11T08:30:00.000Z"
  - restaurantId: "restaurant456"
```

### Product Info Cache (Redis Hash)
```
Key: cart:product:{productId}
Fields:
  - name: string
  - price: string
  - image: string

Example:
cart:product:product789
  - name: "Phở Bò Tái"
  - price: "25000"
  - image: "https://example.com/pho.jpg"
```

## 🔐 Authentication & Session

### 1. **Middleware Auth**
- Verify JWT token từ header hoặc cookie
- Extract user info (id, email, role)
- Attach vào `req.user`

### 2. **Middleware Check Session**
- Kiểm tra user có cart từ restaurant khác không
- Ngăn chặn xung đột giữa các restaurant
- Trả về status 409 nếu có conflict

## 📡 API Endpoints

**LƯU Ý**: Tất cả các API call từ client phải đi qua API Gateway: `http://localhost:3000/api/cart`

### 1. **Thêm Sản Phẩm vào Giỏ Hàng**
```http
POST http://localhost:3000/api/cart/add
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "restaurantId": "restaurant456",
  "productId": "product789",
  "quantity": 2,
  "productName": "Phở Bò Tái",
  "productPrice": 25000,
  "productImage": "https://example.com/pho.jpg"
}

Response 200:
{
  "success": true,
  "message": "Product added to cart",
  "data": {
    "productId": "product789",
    "quantity": 2,
    "restaurantId": "restaurant456"
  }
}

Response 409 (Conflict):
{
  "success": false,
  "message": "You have items from another restaurant in your cart",
  "data": {
    "currentRestaurantId": "restaurant123",
    "newRestaurantId": "restaurant456",
    "action": "clear_or_continue"
  }
}
```

### 2. **Lấy Giỏ Hàng**
```http
GET http://localhost:3000/api/cart/:restaurantId
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": {
    "items": [
      {
        "productId": "product789",
        "quantity": 2,
        "name": "Phở Bò Tái",
        "price": 25000,
        "image": "https://example.com/pho.jpg",
        "subtotal": 50000
      }
    ],
    "metadata": {
      "createdAt": "2025-10-11T08:00:00.000Z",
      "updatedAt": "2025-10-11T08:30:00.000Z",
      "restaurantId": "restaurant456"
    },
    "totalItems": 2,
    "totalAmount": 50000,
    "restaurantId": "restaurant456"
  }
}
```

### 3. **Cập Nhật Số Lượng Sản Phẩm**
```http
PUT http://localhost:3000/api/cart/:restaurantId/:productId
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "quantity": 3
}

Response 200:
{
  "success": true,
  "message": "Cart item updated",
  "data": {
    "productId": "product789",
    "quantity": 3,
    "restaurantId": "restaurant456"
  }
}
```

### 4. **Xóa Sản Phẩm**
```http
DELETE http://localhost:3000/api/cart/:restaurantId/:productId
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "Product removed from cart",
  "data": {
    "productId": "product789",
    "restaurantId": "restaurant456"
  }
}
```

### 5. **Xóa Toàn Bộ Giỏ Hàng (1 Restaurant)**
```http
DELETE http://localhost:3000/api/cart/:restaurantId
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "Cart cleared successfully",
  "data": {
    "restaurantId": "restaurant456"
  }
}
```

### 6. **Xóa Tất Cả Giỏ Hàng**
```http
DELETE http://localhost:3000/api/cart/all/clear
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "All carts cleared successfully",
  "data": {
    "clearedCarts": 2
  }
}
```

### 7. **Lấy Tất Cả Giỏ Hàng**
```http
GET http://localhost:3000/api/cart/all/list
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "All carts retrieved successfully",
  "data": {
    "carts": [
      {
        "restaurantId": "restaurant456",
        "items": [...],
        "metadata": {...},
        "totalItems": 3
      }
    ]
  }
}
```

## 🔄 Workflow Chi Tiết

### **Workflow 1: User Thêm Sản Phẩm vào Giỏ Hàng**

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. User click "Add to Cart"
       ↓
┌──────────────────────────────────┐
│  Optimistic UI Update            │
│  • Update Local Storage ngay     │
│  • Show cart badge update        │
│  • User thấy số lượng tăng       │
└──────┬───────────────────────────┘
       │ 2. Background API call
       ↓
┌──────────────────────────────────┐
│  POST /api/cart/add              │
│  → http://localhost:3000         │
│  Authorization: Bearer {token}   │
└──────┬───────────────────────────┘
       │ 3. API Gateway receives
       ↓
┌──────────────────────────────────┐
│  API Gateway (Port 3000)         │
│  • Proxy to cart-service:3006    │
│  • Forward auth headers          │
└──────┬───────────────────────────┘
       │ 4. Forward to Cart Service
       ↓
┌──────────────────────────────────┐
│  Cart Service (Port 3006)        │
│  • verifyToken middleware        │
│  • checkSession middleware       │
└──────┬───────────────────────────┘
       │ 5. Check session
       ↓
┌──────────────────────────────────┐
│  Redis Check                     │
│  • Tìm cart:user123:*            │
│  • Kiểm tra conflict restaurant  │
└──────┬───────────────────────────┘
       │
       ├─── NO CONFLICT ─────┐
       │                     │ 6. Save to Redis
       │                     ↓
       │            ┌─────────────────────────┐
       │            │  Redis Operations       │
       │            │  • HSET cart key        │
       │            │  • HSET meta key        │
       │            │  • HSET product info    │
       │            │  • EXPIRE 7 days        │
       │            └─────────┬───────────────┘
       │                     │ 7. Response 200
       │                     ↓
       │            ┌─────────────────────────┐
       │            │  Success Response       │
       │            │  ← API Gateway ← Client │
       │            └─────────────────────────┘
       │
       └─── HAS CONFLICT ────┐
                             │ 6. Return 409
                             ↓
                    ┌─────────────────────────┐
                    │  Conflict Response      │
                    │  ← API Gateway ← Client │
                    │  • Show modal           │
                    │  • Ask user action      │
                    └─────────────────────────┘
```

### **Workflow 2: User Xem Giỏ Hàng**

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Open cart page
       ↓
┌──────────────────────────────────┐
│  Load from Local Storage         │
│  • Show cart items immediately   │
│  • Display loading spinner       │
└──────┬───────────────────────────┘
       │ 2. Background sync API
       ↓
┌──────────────────────────────────┐
│  GET /api/cart/:restaurantId     │
│  → http://localhost:3000         │
└──────┬───────────────────────────┘
       │ 3. API Gateway → Cart Service
       ↓
┌──────────────────────────────────┐
│  Redis Operations                │
│  • HGETALL cart key              │
│  • HGETALL meta key              │
│  • HGETALL product info keys     │
└──────┬───────────────────────────┘
       │ 4. Build response
       ↓
┌──────────────────────────────────┐
│  Calculate totals                │
│  • Total items                   │
│  • Total amount                  │
│  • Merge product info            │
└──────┬───────────────────────────┘
       │ 5. Response
       ↓
┌──────────────────────────────────┐
│  Client Update                   │
│  ← API Gateway                   │
│  • Compare with Local Storage    │
│  • Sync if different             │
│  • Update UI                     │
└──────────────────────────────────┘
```

### **Workflow 3: User Thay Đổi Restaurant**

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. User browses Restaurant B
       │    (Currently has cart from Restaurant A)
       ↓
┌──────────────────────────────────┐
│  User adds item from Restaurant B│
└──────┬───────────────────────────┘
       │ 2. POST /api/cart/add
       ↓
┌──────────────────────────────────┐
│  checkSession Middleware         │
│  • Find all carts: cart:user:*   │
│  • Detect cart from Restaurant A │
└──────┬───────────────────────────┘
       │ 3. Conflict detected!
       ↓
┌──────────────────────────────────┐
│  Return 409 Conflict             │
│  {                               │
│    currentRestaurantId: "A",     │
│    newRestaurantId: "B"          │
│  }                               │
└──────┬───────────────────────────┘
       │ 4. Show modal
       ↓
┌──────────────────────────────────┐
│  User Decision Modal             │
│                                  │
│  "Bạn có giỏ hàng từ restaurant │
│   khác. Bạn có muốn xóa?"       │
│                                  │
│  [Xóa và tiếp tục] [Hủy]        │
└──────┬───────────────────────────┘
       │
       ├─── USER CLICKS "Xóa" ───┐
       │                          │ 5. DELETE /cart/:restaurantId
       │                          ↓
       │                 ┌─────────────────────┐
       │                 │  Clear old cart     │
       │                 │  • DEL cart key     │
       │                 │  • DEL meta key     │
       │                 └─────────┬───────────┘
       │                          │ 6. Retry add
       │                          ↓
       │                 ┌─────────────────────┐
       │                 │  POST /api/cart/add │
       │                 │  Success!           │
       │                 └─────────────────────┘
       │
       └─── USER CLICKS "Hủy" ────┐
                                   │ 5. Stay in Restaurant A
                                   ↓
                          ┌─────────────────────┐
                          │  No action          │
                          │  Keep old cart      │
                          └─────────────────────┘
```

### **Workflow 4: Checkout - Chuyển Cart sang Order**

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. User clicks "Checkout"
       ↓
┌──────────────────────────────────┐
│  GET /api/cart/:restaurantId     │
│  • Validate cart not empty       │
│  • Get latest cart data          │
└──────┬───────────────────────────┘
       │ 2. Cart data
       ↓
┌──────────────────────────────────┐
│  POST /orders (Order Service)    │
│  {                               │
│    restaurantId,                 │
│    items: [...],                 │
│    totalAmount                   │
│  }                               │
└──────┬───────────────────────────┘
       │ 3. Order created
       ↓
┌──────────────────────────────────┐
│  DELETE /cart/:restaurantId      │
│  • Clear cart after order        │
│  • Clean Local Storage           │
└──────┬───────────────────────────┘
       │ 4. Redirect to payment
       ↓
┌──────────────────────────────────┐
│  Payment Flow                    │
└──────────────────────────────────┘
```

## ⚙️ Configuration

### Environment Variables (.env)
```env
PORT=3006
JWT_SECRET=your_jwt_secret_key_here
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
CART_TTL=604800
NODE_ENV=production
```

**Lưu ý về Redis Password:**
- Để trống `REDIS_PASSWORD=` nếu Redis không có password (development)
- Nếu Redis có password (production), điền vào: `REDIS_PASSWORD=your_password`
- Cart Service tự động detect và chỉ dùng password khi có giá trị

### TTL (Time To Live)
- **Default**: 7 ngày (604800 giây)
- Cart tự động xóa sau 7 ngày không hoạt động
- TTL reset mỗi khi có update

## 🚀 Development

### Install Dependencies
```bash
cd backend/services/cart-service
pnpm install
```

### Build
```bash
pnpm run build
```

### Start Development
```bash
pnpm run dev
```

### Start Production
```bash
pnpm start
```

## 🐳 Docker

### Build Image
```bash
docker build -t cart-service .
```

### Run with Docker Compose
```bash
docker-compose up api-gateway cart-service redis
```

## 🧪 Testing với Postman

**LƯU Ý**: Sử dụng port 3000 (API Gateway) cho tất cả requests

### 1. Login để lấy token
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 2. Thêm sản phẩm vào cart
```bash
POST http://localhost:3000/api/cart/add
Authorization: Bearer {your_token}
Content-Type: application/json

{
  "restaurantId": "9a1355b4-c858-4245-be78-8fdd9cc751d0",
  "productId": "product789",
  "quantity": 2,
  "productName": "Phở Bò Tái",
  "productPrice": 25000,
  "productImage": "https://example.com/pho.jpg"
}
```

### 3. Xem giỏ hàng
```bash
GET http://localhost:3000/api/cart/9a1355b4-c858-4245-be78-8fdd9cc751d0
Authorization: Bearer {your_token}
```

### 4. Cập nhật số lượng
```bash
PUT http://localhost:3000/api/cart/9a1355b4-c858-4245-be78-8fdd9cc751d0/product789
Authorization: Bearer {your_token}
Content-Type: application/json

{
  "quantity": 3
}
```

### 5. Xóa sản phẩm
```bash
DELETE http://localhost:3000/api/cart/9a1355b4-c858-4245-be78-8fdd9cc751d0/product789
Authorization: Bearer {your_token}
```

### 6. Clear toàn bộ cart của restaurant
```bash
DELETE http://localhost:3000/api/cart/9a1355b4-c858-4245-be78-8fdd9cc751d0
Authorization: Bearer {your_token}
```

### 7. Clear tất cả cart
```bash
DELETE http://localhost:3000/api/cart/all/clear
Authorization: Bearer {your_token}
```

### 8. Lấy tất cả cart
```bash
GET http://localhost:3000/api/cart/all/list
Authorization: Bearer {your_token}
```

## 🔗 Integration

### API Gateway Configuration

File: `backend/services/api-gateway/src/config/index.ts`
```typescript
export const config = {
    // ...existing services...
    cartServiceUrl: process.env.CART_SERVICE_URL || "http://cart-service:3006",
};
```

File: `backend/services/api-gateway/src/server.ts`
```typescript
// Cart Service Proxy
const cartServiceProxy = proxy(config.cartServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp
});

// Cart routes
server.use("/api/cart", cartServiceProxy);
```

### Frontend Integration
```typescript
// ĐÚNG: Gọi qua API Gateway (Port 3000)
const API_BASE_URL = 'http://localhost:3000/api';

const addToCart = async (item) => {
  // 1. Optimistic update
  updateLocalStorage(item);
  updateUI();
  
  // 2. Background sync qua API Gateway
  try {
    const response = await fetch(`${API_BASE_URL}/cart/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(item)
    });
    
    if (response.status === 409) {
      const data = await response.json();
      showConflictModal(data);
    }
  } catch (error) {
    console.error('Failed to add to cart:', error);
    // Rollback local storage
    rollbackLocalStorage(item);
  }
};

// SAI: KHÔNG gọi trực tiếp Cart Service
// const response = await fetch('http://localhost:3006/cart/add', ...); ❌
```

### Request Flow
```
Client (Port 5173)
    ↓ POST http://localhost:3000/api/cart/add
API Gateway (Port 3000)
    ↓ Proxy to http://cart-service:3006/cart/add
Cart Service (Port 3006)
    ↓ Verify JWT + Check Session
    ↓ Save to Redis
Redis (Port 6379)
```

## 🎯 Key Features

1. ✅ **API Gateway Integration**: Tất cả requests qua port 3000
2. ✅ **Optimistic UI**: User experience mượt mà
3. ✅ **Redis Hash**: Performance cao, memory efficient
4. ✅ **Session Management**: Isolation giữa restaurants
5. ✅ **Auto Cleanup**: TTL 7 ngày
6. ✅ **Conflict Detection**: Ngăn cart từ nhiều restaurant
7. ✅ **Product Info Cache**: Giảm calls tới Product Service
8. ✅ **RESTful API**: Chuẩn, dễ maintain

## 📝 Notes

- **Client PHẢI gọi qua API Gateway**: `http://localhost:3000/api/cart/*`
- **KHÔNG gọi trực tiếp Cart Service**: `http://localhost:3006/*` ❌
- Cart data chỉ lưu trong Redis, không có database persistent
- Sau 7 ngày không hoạt động, cart sẽ tự động xóa
- Client nên sync với server mỗi khi mở cart page
- Conflict detection chỉ trigger khi add item mới

---

**Developed with ❤️ for CNPM Project**
