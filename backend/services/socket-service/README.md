# Socket Service

Service xử lý real-time communication sử dụng Socket.IO cho hệ thống Food Delivery.

## Chức năng

- **Real-time order notifications**: Thông báo đơn hàng mới đến restaurant real-time
- **Order status tracking**: Theo dõi trạng thái đơn hàng real-time cho customer
- **Kafka integration**: Nhận events từ order-service và restaurant-service

## Events

### Socket.IO Events (Client → Server)

- `join:restaurant` - Restaurant merchant join room để nhận đơn hàng mới
- `join:order` - Customer join room để theo dõi trạng thái đơn hàng
- `leave:restaurant` - Rời khỏi restaurant room
- `leave:order` - Rời khỏi order room

### Socket.IO Events (Server → Client)

- `order:confirmed` - Đơn hàng mới được confirmed (emit đến restaurant)
- `order:status:update` - Cập nhật trạng thái đơn hàng (emit đến customer)

### Kafka Topics

**Subscribe:**
- `order.confirmed` - Nhận thông báo đơn hàng đã confirmed từ order-service
- `restaurant.order.status` - Nhận cập nhật trạng thái từ restaurant-service

## Setup

```bash
# Install dependencies
npm install

# Copy .env
cp .env.example .env

# Build
npm run build

# Run
npm start
```

## Environment Variables

```
PORT=3011
KAFKA_BROKERS=localhost:9092
KAFKA_SECURITY_PROTOCOL=PLAINTEXT
```

## Architecture

```
Order Service → Kafka (order.confirmed) → Socket Service → Socket.IO → Restaurant Frontend
Restaurant Service → Kafka (restaurant.order.status) → Socket Service → Socket.IO → Customer Frontend
```

