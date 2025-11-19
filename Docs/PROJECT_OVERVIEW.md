# Project Overview - Food Delivery Microservices System

**Ngày cập nhật:** 19/11/2025  
**Kiến trúc:** Microservices Architecture  
**Ngôn ngữ chính:** TypeScript/Node.js  
**Database:** PostgreSQL + Redis  
**Message Broker:** Apache Kafka (Confluent Cloud)  
**Monitoring:** Prometheus + Grafana + Loki

---

## 📋 Tổng quan hệ thống

Hệ thống Food Delivery bao gồm **10 microservices** độc lập, giao tiếp qua API Gateway và Kafka event-driven architecture.

### Kiến trúc tổng thể

```
Frontend (Vercel)
    ↓
API Gateway (Railway)
    ↓
├─ User Service
├─ Restaurant Service  
├─ Product Service
├─ Cart Service
├─ Order Service
├─ Payment Service
├─ Notification Service
├─ Location Service
└─ Drone Service
```

---

## 🎯 Chi tiết từng Service

### 1. API Gateway

**Vai trò:** Cổng giao tiếp chính giữa frontend và backend services

#### Thông tin kỹ thuật
- **Port:** 3000
- **Ngôn ngữ:** TypeScript/Node.js
- **Framework:** Express.js
- **Dependencies chính:**
  - `express-http-proxy` - Proxy requests đến services
  - `helmet` - Security headers
  - `cors` - Cross-Origin Resource Sharing
  - `express-rate-limit` - Rate limiting
  - `compression` - Response compression
  - `jsonwebtoken` - JWT verification

#### Routes & Endpoints

| Route Pattern | Service đích | Mô tả |
|--------------|-------------|-------|
| `/api/auth/*` | User Service | Authentication & Authorization |
| `/api/users/*` | User Service | User management |
| `/api/stores/*` | Restaurant Service | Restaurant/Store info |
| `/api/products/*` | Product Service | Product catalog |
| `/api/cart/*` | Cart Service | Shopping cart |
| `/api/order/*` | Order Service | Order management |
| `/api/payments/*` | Payment Service | Payment processing |
| `/api/location/*` | Location Service | Geocoding & Address |
| `/api/drone/*` | Drone Service | Drone delivery |
| `/api/restaurants/:id/menu` | Aggregation | Restaurant + Products |

#### Đặc điểm nổi bật
- **Aggregation endpoint:** Gộp dữ liệu từ Restaurant + Product Service
- **Rate Limiting:** Bảo vệ endpoints nhạy cảm (auth, order)
- **CORS Configuration:** Hỗ trợ multiple origins (Vercel, Railway)
- **JWT Verification:** Xác thực token và forward user info
- **Health Check:** `/health` endpoint
- **Metrics:** `/metrics` endpoint (Prometheus format)

#### Biến môi trường quan trọng
```bash
PORT=3000
USER_SERVICE_URL=http://user-service.railway.internal:3001
RESTAURANT_SERVICE_URL=http://restaurant-service.railway.internal:3005
PRODUCT_SERVICE_URL=http://product-service.railway.internal:3003
CART_SERVICE_URL=http://cart-service.railway.internal:3007
ORDER_SERVICE_URL=http://order-service.railway.internal:3002
PAYMENT_SERVICE_URL=http://payment-service.railway.internal:3004
LOCATION_SERVICE_URL=http://location-service.railway.internal:3006
ALLOWED_ORIGINS=https://sgu-cnpm-foodfast.vercel.app,https://restaurant-merchant.vercel.app
JWT_SECRET=your-secret-key
```

---

### 2. User Service

**Vai trò:** Quản lý người dùng, authentication, authorization

#### Thông tin kỹ thuật
- **Port:** 3001
- **Database:** PostgreSQL (Prisma ORM)
- **Auth:** JWT + bcryptjs
- **Framework:** Express.js

#### Routes & Endpoints

**Authentication Routes (`/auth/*`):**
- `POST /auth/customer/register` - Đăng ký khách hàng
- `POST /auth/customer/login` - Đăng nhập khách hàng
- `POST /auth/admin/register` - Đăng ký store admin
- `POST /auth/admin/login` - Đăng nhập store admin
- `POST /auth/system-admin/register` - Đăng ký system admin
- `POST /auth/system-admin/login` - Đăng nhập system admin
- `GET /auth/profile` - Lấy thông tin profile (Protected)
- `PUT /auth/profile` - Cập nhật profile (Protected)
- `POST /auth/logout` - Đăng xuất (Protected)
- `POST /auth/verify-token` - Verify JWT token (Internal)

**Address Routes (`/addresses/*`):**
- `GET /addresses` - Lấy danh sách địa chỉ (Protected)
- `POST /addresses` - Thêm địa chỉ mới (Protected)
- `PUT /addresses/:id` - Cập nhật địa chỉ (Protected)
- `DELETE /addresses/:id` - Xóa địa chỉ (Protected)

**Payment Methods Routes (`/payment-methods/*`):**
- `GET /payment-methods` - Lấy danh sách payment methods (Protected)
- `POST /payment-methods` - Thêm payment method (Protected)
- `DELETE /payment-methods/:id` - Xóa payment method (Protected)

#### User Roles
```typescript
enum UserRole {
  CUSTOMER       // Khách hàng
  STORE_ADMIN    // Quản lý cửa hàng
  SYSTEM_ADMIN   // Quản trị hệ thống
}
```

#### Database Schema (Prisma)
```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  password      String
  name          String?
  phone         String?
  role          UserRole @default(CUSTOMER)
  addresses     Address[]
  paymentMethods PaymentMethod[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

#### Biến môi trường
```bash
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/user_db
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

---

### 3. Restaurant Service

**Vai trò:** Quản lý thông tin nhà hàng, menu, đơn hàng của merchant

#### Thông tin kỹ thuật
- **Port:** 3005
- **Database:** PostgreSQL (Prisma ORM)
- **Message Broker:** Kafka (Consumer)
- **Metrics:** Prometheus metrics

#### Routes & Endpoints

**Public Routes:**
- `GET /stores` - Lấy danh sách tất cả cửa hàng
- `GET /stores/:id` - Lấy thông tin chi tiết cửa hàng

**Protected Routes (STORE_ADMIN only):**
- `POST /stores` - Tạo cửa hàng mới
- `GET /stores/my/store` - Lấy thông tin cửa hàng của mình
- `PUT /stores/my/store` - Cập nhật thông tin cửa hàng
- `GET /stores/my/orders` - Lấy danh sách đơn hàng của cửa hàng

**Internal Routes:**
- `GET /stores/internal/check/:ownerId` - Kiểm tra store theo ownerId

#### Kafka Events

**Consumer Topics:**
- `order.confirmed` - Nhận thông báo khi order được confirm
  - Tự động chuyển trạng thái order sang `PREPARING`
  - Lưu order info vào database local

**Event Schema:**
```typescript
{
  eventType: 'ORDER_CONFIRMED',
  orderId: string,
  storeId: string,
  userId: string,
  items: Array<{productId, quantity, price}>,
  totalPrice: number,
  deliveryAddress: string,
  contactPhone: string
}
```

#### Database Schema
```prisma
model Store {
  id          String   @id @default(uuid())
  name        String
  description String?
  address     String
  phone       String
  ownerId     String   // Link đến User Service
  isActive    Boolean  @default(true)
  openTime    String?
  closeTime   String?
  imageUrl    String?
  orders      Order[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Order {
  id              String   @id @default(uuid())
  storeId         String
  orderId         String   // ID từ Order Service
  customerName    String?
  items           Json
  totalPrice      Float
  status          String   @default("PENDING")
  deliveryAddress String?
  contactPhone    String?
  createdAt       DateTime @default(now())
  store           Store    @relation(fields: [storeId], references: [id])
}
```

#### Biến môi trường
```bash
PORT=3005
DATABASE_URL=postgresql://user:password@host:5432/restaurant_db
KAFKA_BROKERS=pkc-xxx.us-east-1.aws.confluent.cloud:9092
KAFKA_USERNAME=xxx
KAFKA_PASSWORD=xxx
KAFKA_SECURITY_PROTOCOL=SASL_SSL
```

---

### 4. Product Service

**Vai trò:** Quản lý sản phẩm, danh mục, tồn kho

#### Thông tin kỹ thuật
- **Port:** 3003
- **Database:** PostgreSQL (Prisma ORM)
- **Message Broker:** Kafka (Producer & Consumer)
- **Metrics:** Prometheus metrics

#### Routes & Endpoints

**Public Routes:**
- `GET /products` - Lấy danh sách sản phẩm (hỗ trợ filter by storeId, categoryId)
- `GET /products/:id` - Lấy thông tin chi tiết sản phẩm
- `GET /categories` - Lấy danh sách categories

**Protected Routes (STORE_ADMIN only):**
- `POST /products` - Tạo sản phẩm mới
- `PUT /products/:id` - Cập nhật sản phẩm
- `DELETE /products/:id` - Xóa sản phẩm
- `PATCH /products/:id/availability` - Cập nhật trạng thái available
- `POST /products/sync-all` - Đồng bộ tất cả products sang Order Service

**Category Routes:**
- `POST /categories` - Tạo category mới (STORE_ADMIN)
- `PUT /categories/:id` - Cập nhật category (STORE_ADMIN)
- `DELETE /categories/:id` - Xóa category (STORE_ADMIN)

#### Kafka Events

**Producer Topics:**
- `product.sync` - Đồng bộ product info sang Order Service
  - Event types: `CREATED`, `UPDATED`, `DELETED`

**Event Schema:**
```typescript
{
  eventType: 'CREATED' | 'UPDATED' | 'DELETED',
  timestamp: string,
  data: {
    id: string,
    name: string,
    price: number,
    description: string,
    imageUrl: string,
    isAvailable: boolean,
    storeId: string,
    categoryId: string
  }
}
```

#### Database Schema
```prisma
model Product {
  id          String   @id @default(uuid())
  name        String
  description String?
  price       Float
  imageUrl    String?
  isAvailable Boolean  @default(true)
  storeId     String
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Category {
  id          String    @id @default(uuid())
  name        String
  description String?
  products    Product[]
  createdAt   DateTime  @default(now())
}
```

#### Biến môi trường
```bash
PORT=3003
DATABASE_URL=postgresql://user:password@host:5432/product_db
KAFKA_BROKERS=pkc-xxx.us-east-1.aws.confluent.cloud:9092
KAFKA_USERNAME=xxx
KAFKA_PASSWORD=xxx
KAFKA_SECURITY_PROTOCOL=SASL_SSL
```

---

### 5. Cart Service

**Vai trò:** Quản lý giỏ hàng của người dùng (Redis-based)

#### Thông tin kỹ thuật
- **Port:** 3007
- **Database:** Redis (fast in-memory storage)
- **Session:** Multi-cart support (per restaurant)
- **Metrics:** Prometheus metrics

#### Routes & Endpoints

**Cart Routes (All Protected):**
- `POST /cart/add` - Thêm sản phẩm vào giỏ hàng
- `GET /cart/:restaurantId` - Lấy giỏ hàng theo restaurant
- `PUT /cart/:restaurantId/:productId` - Cập nhật số lượng sản phẩm
- `DELETE /cart/:restaurantId/:productId` - Xóa sản phẩm khỏi giỏ
- `DELETE /cart/:restaurantId` - Xóa toàn bộ giỏ hàng của restaurant
- `DELETE /cart/all/clear` - Xóa tất cả giỏ hàng của user
- `GET /cart/all/list` - Lấy tất cả giỏ hàng của user

#### Redis Data Structure

**Key Pattern:**
```
cart:{userId}:{restaurantId}
```

**Value Structure:**
```typescript
{
  userId: string,
  restaurantId: string,
  items: [
    {
      productId: string,
      name: string,
      price: number,
      quantity: number,
      imageUrl: string
    }
  ],
  totalPrice: number,
  totalItems: number,
  updatedAt: string
}
```

#### Đặc điểm nổi bật
- **Multi-cart support:** User có thể có nhiều giỏ hàng từ các restaurant khác nhau
- **Session management:** Kiểm tra giỏ hàng có cùng restaurant hay không
- **Auto-sync:** Cập nhật tổng giá và số lượng tự động
- **TTL:** Cart có thể set TTL để tự động xóa sau một thời gian

#### Biến môi trường
```bash
PORT=3007
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

---

### 6. Order Service

**Vai trò:** Quản lý đơn hàng, workflow đặt hàng

#### Thông tin kỹ thuật
- **Port:** 3002
- **Database:** PostgreSQL (Prisma ORM) + Redis (Session management)
- **Message Broker:** Kafka (Producer & Consumer)
- **Metrics:** Prometheus + Kafka metrics

#### Routes & Endpoints

**Order Routes (All Protected):**
- `POST /order/create` - Tạo đơn hàng mới (legacy)
- `POST /order/create-from-cart` - Tạo đơn hàng từ giỏ hàng (recommended)
- `GET /order/status/:orderId` - Lấy trạng thái đơn hàng
- `GET /order/payment-url/:orderId` - Lấy payment URL
- `GET /order/list` - Lấy danh sách đơn hàng của user
- `GET /order/my-orders` - Alias của `/list`
- `POST /order/retry-payment/:orderId` - Thử lại thanh toán

#### Order Workflow

```mermaid
sequenceDiagram
    participant C as Cart Service
    participant O as Order Service
    participant P as Payment Service
    participant R as Restaurant Service
    
    C->>O: Create order from cart
    O->>O: Validate & Create order (PENDING)
    O->>O: Store session in Redis (15min TTL)
    O->>P: Publish order.create event
    P->>P: Create PaymentIntent
    P->>P: Generate VNPay URL
    O->>C: Return order + paymentUrl
    
    Note over O: User redirected to VNPay
    
    P->>P: Receive payment callback
    P->>O: Publish payment.event
    O->>O: Update order to CONFIRMED
    O->>R: Publish order.confirmed
    R->>R: Update to PREPARING
```

#### Kafka Events

**Producer Topics:**
- `order.create` - Tạo đơn hàng mới → Payment Service
- `order.confirmed` - Đơn hàng đã thanh toán → Restaurant Service
- `order.expired` - Đơn hàng hết hạn (Redis expiration)

**Consumer Topics:**
- `payment.event` - Nhận kết quả thanh toán từ Payment Service
- `inventory.reserve.result` - Kết quả reserve inventory (nếu có)
- `product.sync` - Đồng bộ product info từ Product Service

**Event Schema:**
```typescript
// order.create
{
  orderId: string,
  userId: string,
  items: Array<{productId, quantity, price, name}>,
  totalAmount: number,
  deliveryAddress: string,
  contactPhone: string,
  storeId: string
}

// payment.event
{
  orderId: string,
  paymentIntentId: string,
  paymentStatus: 'success' | 'failed',
  amount: number,
  email: string
}
```

#### Redis Session Management

**Order Session:**
- Key: `order:session:{orderId}`
- TTL: 15 minutes
- Auto-cancel order when expired

#### Database Schema
```prisma
model Order {
  id              String   @id @default(uuid())
  userId          String
  storeId         String
  items           Json     // Array of items
  totalAmount     Float
  status          OrderStatus @default(PENDING)
  deliveryAddress String
  contactPhone    String
  paymentIntentId String?
  paymentUrl      String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  DELIVERING
  COMPLETED
  CANCELLED
  EXPIRED
}

model ProductCache {
  id          String   @id
  name        String
  price       Float
  description String?
  imageUrl    String?
  isAvailable Boolean
  storeId     String
  updatedAt   DateTime @updatedAt
}
```

#### Biến môi trường
```bash
PORT=3002
DATABASE_URL=postgresql://user:password@host:5432/order_db
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
KAFKA_BROKERS=pkc-xxx.us-east-1.aws.confluent.cloud:9092
KAFKA_USERNAME=xxx
KAFKA_PASSWORD=xxx
KAFKA_SECURITY_PROTOCOL=SASL_SSL
CART_SERVICE_URL=http://cart-service.railway.internal:3007
RESTAURANT_SERVICE_URL=http://restaurant-service.railway.internal:3005
```

---

### 7. Payment Service

**Vai trò:** Xử lý thanh toán, tích hợp VNPay, Stripe

#### Thông tin kỹ thuật
- **Port:** 3004
- **Database:** PostgreSQL (Prisma ORM)
- **Payment Gateways:** VNPay (primary), Stripe (optional)
- **Message Broker:** Kafka (Producer & Consumer)
- **Metrics:** Prometheus + Kafka metrics

#### Routes & Endpoints

**Payment Routes:**
- `GET /vnpay_return` - VNPay return URL (User redirect)
- `GET /vnpay_ipn` - VNPay IPN (Server-to-server notification)
- `GET /payment-url/:orderId` - Lấy payment URL của order

#### Payment Workflow

```mermaid
sequenceDiagram
    participant O as Order Service
    participant P as Payment Service
    participant V as VNPay
    participant U as User
    
    O->>P: Kafka: order.create
    P->>P: Create PaymentIntent (REQUIRES_PAYMENT)
    P->>P: Create PaymentAttempt
    P->>V: Generate payment URL
    P->>P: Update PaymentAttempt with URL
    P->>O: Return paymentUrl
    
    U->>V: Pay via VNPay
    V->>P: Return URL (redirect user)
    P->>P: Validate signature
    V->>P: IPN (server callback)
    P->>P: Process payment result
    P->>P: Update PaymentIntent status
    P->>O: Kafka: payment.event
```

#### Kafka Events

**Consumer Topics:**
- `order.create` - Nhận order mới từ Order Service

**Producer Topics:**
- `payment.event` - Gửi kết quả thanh toán
  - `paymentStatus`: 'success' | 'failed'

**Event Schema:**
```typescript
// payment.event
{
  orderId: string,
  paymentIntentId: string,
  paymentStatus: 'success' | 'failed',
  amount: number,
  email: string,
  vnpTxnRef: string,
  vnpTransactionNo: string,
  bankCode: string,
  cardType: string
}
```

#### VNPay Integration

**Configuration:**
```bash
VNPAY_TMN_CODE=your-tmn-code
VNPAY_HASH_SECRET=your-hash-secret
VNPAY_API_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://sgu-cnpm-foodfast.vercel.app/payment-result
VNPAY_IPN_URL=https://api-gateway.railway.app/api/payments/vnpay_ipn
```

**Payment URL Parameters:**
- `vnp_Amount` - Số tiền (VND * 100)
- `vnp_OrderInfo` - Thông tin đơn hàng
- `vnp_TxnRef` - Transaction reference (unique)
- `vnp_ReturnUrl` - URL trả về sau thanh toán
- `vnp_IpAddr` - IP người dùng
- `vnp_SecureHash` - Chữ ký bảo mật

#### Database Schema
```prisma
model PaymentIntent {
  id        String   @id @default(uuid())
  orderId   String   @unique
  amount    Float
  currency  String   @default("VND")
  status    PaymentStatus @default(REQUIRES_PAYMENT)
  metadata  Json?
  attempts  PaymentAttempt[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PaymentAttempt {
  id               String   @id @default(uuid())
  paymentIntentId  String
  vnpTxnRef        String   @unique
  paymentUrl       String?
  status           String   @default("CREATED")
  vnpResponseCode  String?
  vnpTransactionNo String?
  bankCode         String?
  cardType         String?
  paymentIntent    PaymentIntent @relation(fields: [paymentIntentId], references: [id])
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

enum PaymentStatus {
  REQUIRES_PAYMENT
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
}
```

#### Biến môi trường
```bash
PORT=3004
DATABASE_URL=postgresql://user:password@host:5432/payment_db
KAFKA_BROKERS=pkc-xxx.us-east-1.aws.confluent.cloud:9092
KAFKA_USERNAME=xxx
KAFKA_PASSWORD=xxx
KAFKA_SECURITY_PROTOCOL=SASL_SSL

# VNPay
VNPAY_TMN_CODE=your-tmn-code
VNPAY_HASH_SECRET=your-hash-secret
VNPAY_API_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://sgu-cnpm-foodfast.vercel.app/payment-result
VNPAY_IPN_URL=https://api-gateway.railway.app/api/payments/vnpay_ipn

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_xxx
FRONTEND_URL=https://sgu-cnpm-foodfast.vercel.app
```

---

### 8. Notification Service

**Vai trò:** Gửi email thông báo cho người dùng

#### Thông tin kỹ thuật
- **Port:** 3008
- **Email Provider:** Resend
- **Message Broker:** Kafka (Consumer only)
- **Metrics:** Prometheus + Kafka metrics

#### Kafka Events

**Consumer Topics:**
- `payment.event` - Nhận kết quả thanh toán để gửi email

#### Email Templates

**Payment Success:**
```html
Subject: Payment Successful - Thank You!
Content:
- Order ID
- Amount paid
- Payment method
- Transaction ID
- Estimated delivery time
```

**Payment Failed:**
```html
Subject: Payment Failed - Please Try Again
Content:
- Order ID
- Reason for failure
- Retry payment link
- Support contact
```

#### Dead Letter Queue (DLQ)

Nếu gửi email thất bại sau 3 lần retry, message sẽ được gửi đến DLQ topic:
- Topic: `notification.dlq`

#### Biến môi trường
```bash
PORT=3008
RESEND_API_KEY=re_xxx
KAFKA_BROKERS=pkc-xxx.us-east-1.aws.confluent.cloud:9092
KAFKA_USERNAME=xxx
KAFKA_PASSWORD=xxx
KAFKA_SECURITY_PROTOCOL=SASL_SSL
```

---

### 9. Location Service

**Vai trò:** Geocoding, tìm kiếm địa chỉ, quản lý tỉnh/huyện/xã

#### Thông tin kỹ thuật
- **Port:** 3006
- **Framework:** Express.js
- **Geocoding API:** Nominatim OpenStreetMap
- **Cache:** node-cache (in-memory)

#### Routes & Endpoints

**Public Routes:**
- `GET /location/search?q={query}` - Tìm kiếm gợi ý địa chỉ
- `POST /location/geocode` - Chuyển địa chỉ thành tọa độ
- `GET /location/provinces` - Lấy danh sách tỉnh/thành phố
- `GET /location/districts/:provinceCode` - Lấy quận/huyện theo tỉnh
- `GET /location/wards/:districtCode` - Lấy phường/xã theo quận

#### Features
- **Autocomplete:** Gợi ý địa chỉ khi người dùng nhập
- **Geocoding:** Chuyển địa chỉ văn bản thành lat/lng
- **Reverse Geocoding:** Chuyển tọa độ thành địa chỉ
- **Administrative Division:** Tỉnh/Quận/Phường của Việt Nam
- **Caching:** Cache kết quả tìm kiếm để tăng tốc độ

#### Response Examples

**Search:**
```json
{
  "success": true,
  "data": [
    {
      "display_name": "227 Nguyễn Văn Cừ, Quận 5, TP.HCM",
      "lat": "10.762622",
      "lon": "106.660172"
    }
  ]
}
```

**Geocode:**
```json
{
  "success": true,
  "data": {
    "lat": 10.762622,
    "lng": 106.660172,
    "address": "227 Nguyễn Văn Cừ, Quận 5, TP.HCM"
  }
}
```

#### Biến môi trường
```bash
PORT=3006
NOMINATIM_API_URL=https://nominatim.openstreetmap.org
CACHE_TTL=3600
```

---

### 10. Drone Service

**Vai trò:** Quản lý drone giao hàng (tương lai)

#### Thông tin kỹ thuật
- **Port:** 3009
- **Database:** PostgreSQL (Prisma ORM)
- **Framework:** Express.js

#### Routes & Endpoints

**Drone Routes:**
- `GET /drone` - Lấy danh sách drones
- `GET /drone/available` - Lấy drones khả dụng
- `GET /drone/:id` - Lấy thông tin drone
- `POST /drone` - Tạo drone mới
- `PUT /drone/:id` - Cập nhật drone
- `PATCH /drone/:id/location` - Cập nhật vị trí drone
- `DELETE /drone/:id` - Xóa drone

**Delivery Routes:**
- `POST /delivery` - Tạo delivery mới
- `GET /delivery/:id` - Lấy thông tin delivery
- `PATCH /delivery/:id/status` - Cập nhật trạng thái delivery

#### Database Schema
```prisma
model Drone {
  id          String   @id @default(uuid())
  name        String
  model       String
  status      DroneStatus @default(AVAILABLE)
  battery     Int      @default(100)
  latitude    Float?
  longitude   Float?
  deliveries  Delivery[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum DroneStatus {
  AVAILABLE
  IN_USE
  CHARGING
  MAINTENANCE
}

model Delivery {
  id          String   @id @default(uuid())
  droneId     String
  orderId     String
  status      DeliveryStatus @default(PENDING)
  fromLat     Float
  fromLng     Float
  toLat       Float
  toLng       Float
  distance    Float?
  estimatedTime Int?
  drone       Drone    @relation(fields: [droneId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum DeliveryStatus {
  PENDING
  ASSIGNED
  IN_TRANSIT
  DELIVERED
  FAILED
}
```

#### Biến môi trường
```bash
PORT=3009
DATABASE_URL=postgresql://user:password@host:5432/drone_db
```

---

## 🔗 Service Communication

### API Gateway → Services (HTTP)

```
API Gateway uses Private Networking (Railway):
- user-service.railway.internal:3001
- restaurant-service.railway.internal:3005
- product-service.railway.internal:3003
- cart-service.railway.internal:3007
- order-service.railway.internal:3002
- payment-service.railway.internal:3004
- location-service.railway.internal:3006
```

### Service → Service (Kafka Events)

```mermaid
graph LR
    O[Order Service] -->|order.create| P[Payment Service]
    P -->|payment.event| O
    P -->|payment.event| N[Notification Service]
    O -->|order.confirmed| R[Restaurant Service]
    O -->|order.expired| N
    PR[Product Service] -->|product.sync| O
```

### Kafka Topics Summary

| Topic | Producer | Consumer | Event Type |
|-------|----------|----------|------------|
| `order.create` | Order Service | Payment Service | Tạo order mới |
| `order.confirmed` | Order Service | Restaurant Service | Order đã thanh toán |
| `order.expired` | Order Service | Notification Service | Order hết hạn |
| `payment.event` | Payment Service | Order Service, Notification Service | Kết quả thanh toán |
| `product.sync` | Product Service | Order Service | Đồng bộ sản phẩm |
| `notification.dlq` | Notification Service | (Manual) | Failed notifications |

---

## 📊 Tech Stack Summary

| Công nghệ | Mục đích | Services sử dụng |
|-----------|----------|------------------|
| **TypeScript** | Ngôn ngữ chính | All services |
| **Node.js** | Runtime | All services |
| **Express.js** | Web framework | All services |
| **PostgreSQL** | Database | User, Restaurant, Product, Order, Payment, Drone |
| **Prisma ORM** | Database ORM | User, Restaurant, Product, Order, Payment, Drone |
| **Redis** | Cache & Session | Cart Service, Order Service |
| **Kafka** | Message Broker | Order, Payment, Product, Restaurant, Notification |
| **Prometheus** | Metrics | All services |
| **JWT** | Authentication | User Service, API Gateway |
| **bcryptjs** | Password hashing | User Service |
| **VNPay** | Payment gateway | Payment Service |
| **Resend** | Email service | Notification Service |
| **Zod** | Validation | Cart, User, Product, Restaurant, Order |

---

## 🚀 Deployment

### Frontend
- **Platform:** Vercel
- **URL:** https://sgu-cnpm-foodfast.vercel.app
- **Framework:** React + Vite + TypeScript

### Backend Services
- **Platform:** Railway
- **Networking:** Private networking (*.railway.internal)
- **API Gateway Public URL:** https://api-gateway-service-production-04a1.up.railway.app

### Databases
- **PostgreSQL:** Railway managed PostgreSQL
- **Redis:** Railway managed Redis

### Message Broker
- **Kafka:** Confluent Cloud
- **Plan:** Basic cluster

---

## 📝 Naming Conventions

### API Endpoints
- RESTful style: `/resources`, `/resources/:id`
- Kebab-case: `/my-orders`, `/payment-methods`
- Version prefix (future): `/v1/products`

### Environment Variables
- UPPERCASE_SNAKE_CASE
- Service prefix: `USER_SERVICE_URL`, `ORDER_SERVICE_URL`
- Group by functionality: `KAFKA_*`, `VNPAY_*`, `DATABASE_*`

### Code Style
- camelCase: functions, variables
- PascalCase: classes, types, interfaces
- UPPER_SNAKE_CASE: constants, enums

---

## 🔐 Security

### Authentication
- JWT tokens (7 days expiry)
- HTTP-only cookies (for refresh tokens)
- Password hashing with bcryptjs (10 rounds)

### Authorization
- Role-based access control (CUSTOMER, STORE_ADMIN, SYSTEM_ADMIN)
- Middleware: `authenticateToken`, `requireStoreAdmin`

### API Security
- Helmet (security headers)
- CORS (whitelist origins)
- Rate limiting (auth endpoints: 5 req/15min, order endpoints: 10 req/1min)
- Input validation (Zod schemas)

### Payment Security
- VNPay signature verification
- HTTPS only for payment callbacks
- IPN (Instant Payment Notification) for server-side verification

---

## 📈 Performance Optimization

### Caching
- **Redis:** Cart data, order sessions
- **Node-cache:** Location search results
- **CDN:** Static assets (Vercel)

### Database
- Indexes on frequently queried fields
- Connection pooling (Prisma)
- Pagination for list endpoints

### API Gateway
- Response compression (gzip)
- HTTP/2 support
- Connection keep-alive

---

## 🎯 Future Enhancements

1. **GraphQL Gateway** - Replace REST API Gateway
2. **Elasticsearch** - Full-text search for products/restaurants
3. **WebSocket** - Real-time order tracking
4. **Redis Pub/Sub** - Alternative to Kafka for some events
5. **Microservice Mesh** - Istio/Linkerd for service mesh
6. **Circuit Breaker** - Resilience patterns (Hystrix/Resilience4j)
7. **API Versioning** - Support multiple API versions
8. **Multi-language Support** - i18n for global expansion

---

**Tài liệu liên quan:**
- [MONITORING_GUIDE.md](./MONITORING_GUIDE.md) - Hướng dẫn monitoring
- [K6_LOAD_TESTING_GUIDE.md](./K6_LOAD_TESTING_GUIDE.md) - Hướng dẫn load testing
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Hướng dẫn testing

