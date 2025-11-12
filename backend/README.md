# Backend - Payment Processing Microservices

Thư mục backend chứa tất cả các microservices cho hệ thống xử lý thanh toán.

## Cấu trúc Services

```
backend/
└── services/
    ├── api-gateway/          # API Gateway - Điều hướng request
    ├── user-service/         # Quản lý người dùng và xác thực
    ├── product-service/      # Quản lý sản phẩm và danh mục
    ├── order-service/        # Quản lý đơn hàng
    ├── payment-service/      # Xử lý thanh toán VNPay
    └── notification-service/ # Gửi thông báo email
```

## Công nghệ sử dụng

- **Node.js** + **TypeScript** - Runtime và ngôn ngữ
- **Express.js** - Web framework
- **PostgreSQL** - Database cho user, order, product services
- **Prisma** - ORM
- **Apache Kafka** - Message broker
- **VNPay** - Payment gateway
- **Docker** - Containerization
- **Jest** - Testing framework

## Ports

| Service | Port |
|---------|------|
| API Gateway | 3000 |
| User Service | 1000 |
| Order Service | 2000 |
| Product Service | 3004 |
| Payment Service | 4000 |
| Notification Service | 5001 |

## Database Ports

| Database | Port |
|----------|------|
| User DB | 5432 |
| Order DB | 5433 |
| Product DB | 5434 |
| Kafka | 9092 |
| Zookeeper | 2181 |

## Chạy Services

```bash
# Từ thư mục root
docker-compose up --build

# Hoặc chỉ chạy một service cụ thể
docker-compose up user-service
```

## Testing

Mỗi service có test riêng:

```bash
# Payment Service
cd backend/services/payment-service
npm test

# Order Service  
cd backend/services/order-service
npm test
```


ádadsa