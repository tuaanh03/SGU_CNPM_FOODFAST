# 🍔 Food Delivery Microservices Platform - Dự Án Thực Tế

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue.svg)](https://www.docker.com/)

> **Hệ thống đặt món ăn trực tuyến đầy đủ tính năng, được xây dựng theo kiến trúc Microservices với xử lý thanh toán VNPay tích hợp hoàn chỉnh**


## 🎯 Giới Thiệu Dự Án

**Food Delivery Microservices Platform** là một hệ thống đặt món ăn trực tuyến được xây dựng theo kiến trúc microservices hiện đại. Dự án mô phỏng một nền tảng thương mại điện tử thực tế với đầy đủ các tính năng:

### 🌟 Điểm Nổi Bật

- ✅ **Kiến trúc Microservices** hoàn chỉnh với 8 services độc lập
- ✅ **Event-Driven Architecture** sử dụng Apache Kafka
- ✅ **Xử lý thanh toán VNPay** tích hợp đầy đủ (IPN callback, return URL)
- ✅ **Quản lý giỏ hàng** với Redis cache
- ✅ **Session Management** cho order với tự động hết hạn
- ✅ **Read Model Pattern** cho hiệu suất cao
- ✅ **API Gateway** với authentication & rate limiting
- ✅ **Containerization** hoàn toàn với Docker
- ✅ **Database Migration** với Prisma ORM
- ✅ **Unit Testing & Integration Testing**
- ✅ **Sẵn sàng deploy** lên Azure Cloud Platform

### 🎨 Use Cases Thực Tế

1. **Khách hàng**: Đăng ký, đăng nhập, tìm nhà hàng, thêm món vào giỏ, đặt hàng, thanh toán online
2. **Nhà hàng**: Quản lý thông tin cửa hàng, thêm/sửa/xóa món ăn, theo dõi đơn hàng
3. **Hệ thống**: Xử lý thanh toán tự động, gửi email thông báo, đồng bộ dữ liệu giữa các service

---

## 🛠 Công Nghệ Sử Dụng

### Backend Stack

| Công Nghệ | Phiên Bản | Mục Đích |
|-----------|-----------|----------|
| **Node.js** | v20+ | Runtime environment |
| **TypeScript** | 5.7+ | Type-safe development |
| **Express.js** | 4.21+ | Web framework |
| **Prisma ORM** | 6.16+ | Database ORM & migrations |
| **PostgreSQL** | 15+ | Primary database |
| **Redis** | 7+ | Cache & session storage |
| **Apache Kafka** | 7.4.4 | Message broker (Event streaming) |
| **KafkaJS** | 2.2.4 | Kafka client for Node.js |

### Frontend Stack

| Công Nghệ | Phiên Bản | Mục Đích |
|-----------|-----------|----------|
| **React** | 19.1+ | UI library |
| **TypeScript** | 5.7+ | Type-safe frontend |
| **Vite** | Latest | Build tool |
| **TailwindCSS** | 4.1+ | Styling framework |
| **Radix UI** | Latest | Accessible components |
| **React Router** | 7.9+ | Client-side routing |
| **Axios** | 1.7+ | HTTP client |
| **React Hook Form** | 7.63+ | Form validation |

### DevOps & Tools

- **Docker & Docker Compose**: Container orchestration
- **Nginx**: Reverse proxy cho frontend
- **Jest**: Unit & integration testing
- **Morgan**: HTTP request logging
- **Helmet**: Security headers
- **Zod**: Schema validation

### Third-Party Integrations

- **VNPay Payment Gateway**: Thanh toán trực tuyến cho thị trường Việt Nam
- **Email Service**: Gửi thông báo qua SMTP

---

### Microservices Overview

#### 1. **API Gateway** (Port 3000)
- Reverse proxy cho tất cả requests
- JWT authentication & authorization
- Request validation với Zod
- Rate limiting
- CORS configuration

#### 2. **User Service** (Port 3001)
- Quản lý user (Customer & Restaurant Admin)
- Signup/Signin với bcrypt password hashing
- JWT token generation & refresh
- User profile management
- Role-based access control

#### 3. **Order Service** (Port 3002)
- Tạo order từ cart
- Order status management (pending → success/failed/expired)
- Order session với tự động hết hạn (15 phút)
- Retry payment logic
- Kafka consumer: `order.create`, `payment.event`
- Kafka producer: `order.expired`, `order.retry.payment`

#### 4. **Product Service** (Port 3003)
- CRUD sản phẩm (món ăn)
- Category management
- Product availability & sold-out tracking
- Kafka producer: `product.sync` (sync to Order Service)
- Image upload & management

#### 5. **Restaurant Service** (Port 3004)
- CRUD cửa hàng (Store)
- Store profile & settings
- Operating hours management
- Store search & filtering

#### 6. **Payment Service** (Port 3005)
- **VNPay integration** đầy đủ
- Generate VNPay payment URL với HMAC SHA512 signature
- Xử lý IPN callback từ VNPay
- Return URL validation
- Payment status tracking
- Kafka consumer: `order.create`
- Kafka producer: `payment.event`

#### 7. **Cart Service** (Port 3006)
- Redis-based cart storage
- Add/remove/update items
- Cart validation trước khi checkout
- Clear cart sau khi đặt hàng thành công
- Per-restaurant cart isolation

#### 8. **Notification Service** (Port 3007)
- Email notifications
- Template-based emails
- Dead Letter Queue (DLQ) cho failed messages
- Kafka consumer: `payment.event`
- SMTP integration

---

## 💼 Nghiệp Vụ & Tính Năng

### 🛒 Quản Lý Giỏ Hàng
- [x] Thêm món ăn vào giỏ hàng (hỗ trợ nhiều cửa hàng)
- [x] Cập nhật số lượng sản phẩm
- [x] Xóa sản phẩm khỏi giỏ hàng
- [x] Xem giỏ hàng theo restaurant
- [x] Cache giỏ hàng với Redis (high performance)
- [x] Tự động clear giỏ sau khi đặt hàng thành công

### 📦 Quản Lý Đơn Hàng
- [x] Tạo đơn hàng từ giỏ hàng
- [x] Validate món ăn qua MenuItemRead (Read Model)
- [x] Snapshot giá tại thời điểm đặt hàng
- [x] Order session với thời gian hết hạn (15 phút)
- [x] Tự động hủy đơn hàng khi hết session
- [x] Retry payment (tối đa 3 lần)
- [x] Order status tracking: `pending`, `success`, `failed`, `expired`
- [x] Order history cho user

### 💳 Xử Lý Thanh Toán
- [x] Tích hợp VNPay Payment Gateway
- [x] Generate payment URL với signature bảo mật
- [x] Xử lý IPN (Instant Payment Notification) callback
- [x] Xử lý Return URL sau thanh toán
- [x] Payment status synchronization
- [x] Transaction tracking với `vnp_TxnRef`
- [x] Sandbox & Production environment support

### 🍕 Quản Lý Sản Phẩm
- [x] CRUD món ăn
- [x] Category management
- [x] Product availability toggle
- [x] Sold-out tracking với thời gian hết hàng
- [x] Real-time sync sang Order Service qua Kafka
- [x] Price history tracking
- [x] Product search & filter

### 🏪 Quản Lý Nhà Hàng
- [x] CRUD cửa hàng
- [x] Store profile management
- [x] Menu assignment
- [x] Operating hours configuration
- [x] Store search by location/category

### 👤 Quản Lý Người Dùng
- [x] Signup/Signin với JWT
- [x] Password hashing với bcrypt
- [x] Role-based access: Customer, Store Admin
- [x] User profile management
- [x] Token refresh mechanism

### 📧 Thông Báo
- [x] Email notification sau thanh toán
- [x] Order confirmation emails
- [x] Payment status emails
- [x] Template-based email system
- [x] Dead Letter Queue cho retry logic

---




## ☁️ Deploy Lên Azure

Dự án này đang được chuẩn bị sẵn sàng để deploy lên **Microsoft Azure** với Azure Student account.

### Kiến Trúc Azure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Resource Group                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Azure Container Registry (ACR)                   │  │
│  │  - api-gateway:latest                                    │  │
│  │  - user-service:latest                                   │  │
│  │  - order-service:latest                                  │  │
│  │  - payment-service:latest                                │  │
│  │  - product-service:latest                                │  │
│  │  - restaurant-service:latest                             │  │
│  │  - cart-service:latest                                   │  │
│  │  - notification-service:latest                           │  │
│  │  - frontend:latest                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Azure App Service Plan (Linux)                   │  │
│  │  - Tier: B1 (Basic) hoặc F1 (Free)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │  Web App       │  │  Web App       │  │  Web App        │  │
│  │  api-gateway   │  │  user-service  │  │  order-service  │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │  Web App       │  │  Web App       │  │  Web App        │  │
│  │payment-service │  │ product-service│  │ cart-service    │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐                        │
│  │  Web App       │  │  Static Web App│                        │
│  │notification-   │  │  Frontend      │                        │
│  │  service       │  │                │                        │
│  └────────────────┘  └────────────────┘                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Azure Database for PostgreSQL (Flexible Server)       │  │
│  │   - user_db                                              │  │
│  │   - order_db                                             │  │
│  │   - payment_db                                           │  │
│  │   - product_db                                           │  │
│  │   - store_db                                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Azure Cache for Redis (C0 Basic)                      │  │
│  │   - Port: 6380 (TLS)                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Confluent Cloud Kafka (Free Tier)                     │  │
│  │   - Bootstrap Server: pkc-xxxx.confluent.cloud:9092     │  │
│  │   - SASL/SSL Authentication                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Azure Key Vault (Optional)                            │  │
│  │   - Store secrets (DB passwords, API keys, etc.)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quy Trình Deploy

Tài liệu chi tiết: [AZURE_STUDENT_DEPLOY.md](AZURE_STUDENT_DEPLOY.md)

**Tóm tắt các bước:**

#### 1. Chuẩn bị Infrastructure

**a) Azure Database for PostgreSQL:**
- Tạo Flexible Server
- Tạo 5 databases: `user_db`, `order_db`, `payment_db`, `product_db`, `store_db`
- Lưu connection string

**b) Azure Cache for Redis:**
- Tạo Redis instance (C0/C1)
- Enable TLS (port 6380)
- Lưu hostname và primary key

**c) Confluent Cloud Kafka:**
- Đăng ký free tier
- Tạo Kafka cluster
- Tạo API Key & Secret
- Tạo topics: `order.create`, `payment.event`, `product.sync`, `order.expired`, `order.retry.payment`, `inventory.reserve.result`

#### 2. Build & Push Docker Images

```bash
# Login to ACR
az acr login --name yourregistry

# Build & push từng service
cd backend/services/api-gateway
docker build -t yourregistry.azurecr.io/api-gateway:latest .
docker push yourregistry.azurecr.io/api-gateway:latest

# Lặp lại cho các services khác...
```

#### 3. Tạo Web Apps



#### 4. Run Database Migrations



#### 5. Deploy Frontend



#### 6. Configure CI/CD

- Enable Continuous Deployment trong ACR
- Tạo webhook cho mỗi Web App
- Mỗi lần push image mới → tự động redeploy

#### 7. Monitoring & Logging

- Enable Application Insights
- Xem logs realtime: Portal → Web App → Log stream
- Set up alerts cho errors & performance

### Chi Phí Ước Tính (Azure Student)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| App Service Plan | B1 Basic | ~$13 |
| PostgreSQL Flexible | B1ms | ~$12 |
| Azure Cache for Redis | C0 | ~$16 |
| Confluent Cloud Kafka | Free | $0 |
| Container Registry | Basic | $5 |
| Bandwidth | 5GB free | $0 |
| **Total** | | **~$46/month** |

💡 **Azure Student** cung cấp **$100 credit** → có thể chạy free trong 2 tháng!

---

## 🗺 Roadmap

### ✅ Hoàn Thành

- [x] Kiến trúc microservices cơ bản
- [x] Authentication & Authorization với JWT
- [x] Order management
- [x] VNPay payment integration
- [x] Cart với Redis
- [x] Order session management
- [x] Product sync workflow
- [x] Email notifications
- [x] Docker containerization
- [x] Database migrations với Prisma

### 🚧 Đang Phát Triển

- [ ] Background job cho session expiration
- [ ] Inventory management
- [ ] Order tracking realtime (WebSocket)
- [ ] Admin dashboard
- [ ] Analytics & reporting
- [ ] Delivery by Drone (simulated)
- [ ] Unit & integration tests
- [ ] End-to-end tests

### 🔮 Tương Lai

- [ ] Multiple payment gateways (Momo, ZaloPay, Stripe)
- [ ] Recommendation system
- [ ] Loyalty program
- [ ] Delivery tracking với Google Maps
- [ ] Mobile apps (React Native)
- [ ] GraphQL API
- [ ] Kubernetes deployment
- [ ] Service mesh (Istio)
- [ ] Observability (Prometheus + Grafana)
- [ ] CI/CD với GitHub Actions
- [ ] Load testing với k6
- [ ] API versioning
- [ ] Multi-tenancy support

---


