# payment-processing-microservices Architecture

## Tổng quan

Hệ thống xử lý thanh toán dựa trên kiến trúc microservices với cấu trúc được tổ chức thành backend và frontend riêng biệt. Backend bao gồm năm dịch vụ: **Gateway Service**, **User Service**, **Order Service**, **Payment Service**, và **Notification Service**.  
Các dịch vụ giao tiếp thông qua REST APIs, Kafka topics, và tuân theo kiến trúc hướng sự kiện để đảm bảo khả năng mở rộng và độ tin cậy.

![Architecture Diagram](./assets/architecture.png)

## Cấu trúc Project

```
payment-processing-microservices-main/
├── backend/                    # Backend services
│   └── services/
│       ├── api-gateway/        # API Gateway - Reverse proxy
│       ├── user-service/       # Quản lý người dùng và xác thực
│       ├── product-service/    # Quản lý sản phẩm và danh mục
│       ├── order-service/      # Quản lý đơn hàng
│       ├── payment-service/    # Xử lý thanh toán VNPay
│       └── notification-service/ # Gửi thông báo email
├── frontend/                   # Frontend application (placeholder)
├── assets/                     # Architecture diagrams
├── docker-compose.yml          # Docker orchestration
└── README.md                   # Documentation chính
```
## Demo accounts (for testing)
- Customer app:
    - Email: anhngo876@gmail.com
    - Password: password123
- Merchant app:
    - Email: longphat@gmail.com
    - Password: password123
- Admin app:
    - Email: admin@foodfast.com
    - Password: password123

## Project Review (English)

| Aspect | Status | Notes |
|---|---:|---|
| Architecture | Microservices, event-driven | Services communicate via REST and Kafka; clear separation backend/frontend |
| Technologies | Node.js, Kafka, Docker, PostgreSQL, VNPay, Socket (WebSocket) | Common patterns used; observability with Prometheus/Grafana included |
| Real-time & Tracking | Implemented via socket service | Order state updates and drone tracking pushed in real-time to clients |
| Mapping & Drone Simulation | Map APIs + simulated drone service | Drone position updates streamed and rendered on frontend; basic simulation implemented |
| CI & Testing | Basic scripts present | Needs full CI pipelines (unit/integration/e2e/load) and automated checks |
| Scalability & Deployment | Docker Compose included | Missing production-grade orchestration: load balancing, Kubernetes, autoscaling |

# SGU_CNPM_FOODFAST







