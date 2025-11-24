# Hướng dẫn triển khai Location Tracking cho Order và Drone Dispatch

## Tổng quan

Tài liệu này mô tả chi tiết các thay đổi đã thực hiện để:
1. **Lưu tọa độ khách hàng** khi tạo đơn hàng
2. **Gửi tọa độ nhà hàng (pickup) và khách hàng (delivery)** khi đơn chuyển sang READY_FOR_PICKUP
3. Chuẩn bị cho admin-dashboard hiển thị map tracking

## Các thay đổi đã thực hiện

### 1. Order Service

#### 1.1. Database Schema (`prisma/schema.prisma`)
```prisma
model Order {
  // ...existing fields...
  
  deliveryAddress String?
  contactPhone    String?
  
  // ✅ THÊM MỚI: Tọa độ giao hàng (delivery destination)
  customerLatitude  Float?
  customerLongitude Float?

  items OrderItem[]
  // ...rest...
}
```

#### 1.2. Validation Schema (`src/validations/order.validation.ts`)
```typescript
export const OrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, "Đơn hàng phải có ít nhất 1 sản phẩm"),
  deliveryAddress: z.string().optional(),
  contactPhone: z.string().optional(),
  note: z.string().optional(),
  storeId: z.string().optional(),
  // ✅ THÊM MỚI
  customerLatitude: z.number().optional(),
  customerLongitude: z.number().optional(),
});
```

#### 1.3. Controller (`src/controllers/order.ts`)

**Thay đổi trong `createOrder`:**
- Nhận `customerLatitude`, `customerLongitude` từ request body
- Lưu vào database khi tạo order
- Gửi trong Kafka event `order.create`

**Thay đổi trong `createOrderFromCart`:**
- Nhận `customerLatitude`, `customerLongitude` từ request body
- Lưu vào database khi tạo order
- Gửi trong Kafka event `order.create`

#### 1.4. Kafka Producer (`src/utils/kafka.ts`)

**Event `order.create`:**
```typescript
const orderPayload = {
  orderId: savedOrder.id,
  userId: savedOrder.userId,
  storeId: savedOrder.storeId,
  items: validItems,
  totalPrice: savedOrder.totalPrice,
  deliveryAddress: savedOrder.deliveryAddress,
  // ✅ THÊM MỚI
  customerLatitude: savedOrder.customerLatitude,
  customerLongitude: savedOrder.customerLongitude,
  expiresAt: session.expirationTime.toISOString(),
  timestamp: new Date().toISOString()
};
```

**Event `ORDER_CONFIRMED` (gửi đến Restaurant Service):**
```typescript
const confirmedPayload = {
  eventType: "ORDER_CONFIRMED",
  orderId: order.id,
  storeId: order.storeId,
  userId: order.userId,
  items,
  totalPrice: order.totalPrice,
  deliveryAddress: order.deliveryAddress,
  contactPhone: order.contactPhone,
  note: order.note,
  // ✅ THÊM MỚI
  customerLatitude: order.customerLatitude,
  customerLongitude: order.customerLongitude,
  confirmedAt: new Date().toISOString(),
  estimatedPrepTime,
};
```

### 2. Restaurant Service

#### 2.1. Kafka Consumer (`src/utils/kafka.ts`)

**Nhận event `ORDER_CONFIRMED` và lưu tọa độ:**
```typescript
const customerInfo = {
  userId: userId || null,
  deliveryAddress: deliveryAddress || null,
  contactPhone: contactPhone || null,
  note: note || null,
  estimatedPrepTime: estimatedPrepTime || null,
  // ✅ THÊM MỚI: Lưu tọa độ khách hàng
  customerLatitude: payload.customerLatitude || null,
  customerLongitude: payload.customerLongitude || null
};

await prisma.restaurantOrder.upsert({
  where: { orderId },
  update: {
    // ...
    customerInfo,
  },
  create: {
    // ...
    customerInfo,
  }
});
```

#### 2.2. Controller (`src/controllers/store.ts`)

**Function `transitionToReady` - gửi event ORDER_READY_FOR_PICKUP:**
```typescript
export async function transitionToReady(restaurantOrderId: string) {
  const updated = await prisma.restaurantOrder.update({
    where: { id: restaurantOrderId },
    data: {
      restaurantStatus: "READY_FOR_PICKUP",
      readyAt: new Date()
    }
  });

  const store = await prisma.store.findUnique({ where: { id: updated.storeId } });
  
  // ✅ Extract customer coordinates
  const customerInfo = updated.customerInfo as any;
  const customerLat = customerInfo?.customerLatitude || null;
  const customerLng = customerInfo?.customerLongitude || null;

  await publishRestaurantOrderStatusEvent({
    eventType: "ORDER_READY_FOR_PICKUP",
    orderId: updated.orderId,
    storeId: updated.storeId,
    restaurantStatus: "READY_FOR_PICKUP",
    readyAt: new Date().toISOString(),
    // ✅ Pickup location (nhà hàng)
    pickupLocation: {
      storeId: updated.storeId,
      restaurantName: store?.name || '',
      address: store?.address || '',
      lat: store?.latitude || null,
      lng: store?.longitude || null,
    },
    // ✅ Delivery destination (khách hàng)
    deliveryDestination: {
      address: customerInfo?.deliveryAddress || '',
      lat: customerLat,
      lng: customerLng,
    },
    customerInfo: updated.customerInfo,
    items: updated.items,
    totalPrice: updated.totalPrice,
  });
}
```

### 3. Frontend (cnpm-fooddelivery)

#### 3.1. Order Service Interface (`src/services/order.service.ts`)

**Cập nhật interface:**
```typescript
export interface CreateOrderFromCartRequest {
  storeId: string;
  deliveryAddress: string;
  contactPhone: string;
  note?: string;
  // ✅ THÊM MỚI
  customerLatitude?: number;
  customerLongitude?: number;
}
```

#### 3.2. CheckoutPage (`src/pages/CheckoutPage.tsx`)

**Gửi tọa độ khi tạo order:**
```typescript
const response = await orderService.createOrderFromCart({
  storeId: storeId,
  deliveryAddress: deliveryAddressText,
  contactPhone: selectedAddress.phone,
  note: formData.note || undefined,
  // ✅ THÊM MỚI: Gửi tọa độ khách hàng
  customerLatitude: selectedAddress.latitude,
  customerLongitude: selectedAddress.longitude,
});
```

## Workflow Event Flow

### Khi Order được tạo (order.create):

```
Frontend (CheckoutPage)
  ↓ (gửi customerLatitude, customerLongitude)
Order Service
  ↓ (lưu vào Order table)
  ↓ (publish event order.create với tọa độ)
Payment Service (consumer)
```

**Payload `order.create`:**
```json
{
  "orderId": "uuid",
  "userId": "uuid",
  "storeId": "uuid",
  "items": [...],
  "totalPrice": 100000,
  "deliveryAddress": "123 Nguyễn Huệ, P.Bến Nghé, Q.1, TP.HCM",
  "customerLatitude": 10.786511,
  "customerLongitude": 106.699475,
  "expiresAt": "2025-11-24T10:30:00Z",
  "timestamp": "2025-11-24T10:15:00Z"
}
```

### Khi Payment thành công → ORDER_CONFIRMED:

```
Payment Service
  ↓ (publish payment.event success)
Order Service (consumer)
  ↓ (update status → confirmed)
  ↓ (publish ORDER_CONFIRMED với tọa độ)
Restaurant Service (consumer)
  ↓ (lưu vào RestaurantOrder với customerInfo chứa tọa độ)
  ↓ (auto transition → PREPARING sau 30s)
```

**Payload `ORDER_CONFIRMED`:**
```json
{
  "eventType": "ORDER_CONFIRMED",
  "orderId": "uuid",
  "storeId": "uuid",
  "userId": "uuid",
  "items": [...],
  "totalPrice": 100000,
  "deliveryAddress": "123 Nguyễn Huệ...",
  "contactPhone": "0901234567",
  "customerLatitude": 10.786511,
  "customerLongitude": 106.699475,
  "confirmedAt": "2025-11-24T10:15:30Z",
  "estimatedPrepTime": 20
}
```

### Khi Order chuyển sang READY_FOR_PICKUP:

```
Restaurant Merchant (admin)
  ↓ (click "Ready for Pickup")
Restaurant Service
  ↓ (update status → READY_FOR_PICKUP)
  ↓ (publish ORDER_READY_FOR_PICKUP với pickupLocation + deliveryDestination)
Order Service + Socket Service (consumers)
  ↓ (emit real-time đến admin-dashboard và customer app)
```

**Payload `ORDER_READY_FOR_PICKUP`:**
```json
{
  "eventType": "ORDER_READY_FOR_PICKUP",
  "orderId": "uuid",
  "storeId": "uuid",
  "restaurantStatus": "READY_FOR_PICKUP",
  "readyAt": "2025-11-24T10:35:00Z",
  "pickupLocation": {
    "storeId": "uuid",
    "restaurantName": "Nhà hàng ABC",
    "address": "456 Lê Lợi, Q.1, TP.HCM",
    "lat": 10.775000,
    "lng": 106.702000
  },
  "deliveryDestination": {
    "address": "123 Nguyễn Huệ, P.Bến Nghé, Q.1, TP.HCM",
    "lat": 10.786511,
    "lng": 106.699475
  },
  "customerInfo": {
    "userId": "uuid",
    "deliveryAddress": "...",
    "contactPhone": "0901234567",
    "customerLatitude": 10.786511,
    "customerLongitude": 106.699475
  },
  "items": [...],
  "totalPrice": 100000
}
```

## Bước triển khai (Deploy)

### 1. Order Service

```bash
cd backend/services/order-service

# Generate migration
npx prisma migrate dev --name add_customer_coordinates

# Generate Prisma Client
npx prisma generate

# Deploy migration (production)
npx prisma migrate deploy
```

### 2. Frontend Build

```bash
cd frontend/cnpm-fooddelivery

# Clear TypeScript cache (nếu gặp lỗi TS2353)
rm -rf node_modules/.cache
rm -rf dist

# Rebuild
npm run build

# Hoặc restart dev server
npm run dev
```

### 3. Restart Services

```bash
# Docker Compose
docker-compose restart order-service restaurant-service

# Railway (tự động restart khi push code)
git add .
git commit -m "feat: add customer coordinates tracking for delivery"
git push origin main
```

### 3. Verify

**Test Order Creation:**
```bash
curl -X POST https://api-gateway.railway.app/api/orders/from-cart \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "store-uuid",
    "deliveryAddress": "123 Nguyễn Huệ...",
    "contactPhone": "0901234567",
    "customerLatitude": 10.786511,
    "customerLongitude": 106.699475,
    "note": "Test order"
  }'
```

**Check Database:**
```sql
-- Order Service DB
SELECT id, deliveryAddress, customerLatitude, customerLongitude 
FROM "Order" 
WHERE "userId" = 'user-uuid' 
ORDER BY "createdAt" DESC 
LIMIT 5;

-- Restaurant Service DB
SELECT id, orderId, "customerInfo" 
FROM "RestaurantOrder" 
WHERE "storeId" = 'store-uuid' 
ORDER BY "receivedAt" DESC 
LIMIT 5;
```

## Tích hợp Admin Dashboard (Bước tiếp theo)

### 1. Socket Service - Subscribe ORDER_READY_FOR_PICKUP

```typescript
// backend/services/socket-service/src/utils/kafka.ts
if (eventType === "ORDER_READY_FOR_PICKUP") {
  const { orderId, pickupLocation, deliveryDestination } = event;
  
  // Emit đến admin-dashboard room
  io.to('admin-dashboard').emit('order:ready', {
    orderId,
    pickupLocation,
    deliveryDestination,
    // Dùng để hiển thị trên map
  });
  
  // Emit đến customer
  io.to(`user:${event.customerInfo.userId}`).emit('order:ready', {
    orderId,
    status: 'READY_FOR_PICKUP',
    pickupLocation,
    estimatedDeliveryTime: calculateETA(pickupLocation, deliveryDestination)
  });
}
```

### 2. Admin Dashboard - Order Detail Page

**Component structure:**
```
OrderDetailPage
  ├── OrderInfo (status, items, total)
  ├── CustomerInfo (address, phone, coordinates)
  ├── MapTracking (nếu status = readyForPickup || delivering)
  │    ├── Mapbox Map
  │    ├── Pickup Marker (nhà hàng)
  │    ├── Delivery Marker (khách hàng)
  │    └── Route Line
  └── DroneAssignment (nếu status = readyForPickup)
       ├── Nearby Drones List
       ├── Assign Button
       └── Tracking Status
```

**Map Implementation (Mapbox):**
```typescript
// admin-dashboard/src/components/OrderMapTracking.tsx
import mapboxgl from 'mapbox-gl';

interface MapTrackingProps {
  pickupLocation: { lat: number; lng: number; name: string };
  deliveryDestination: { lat: number; lng: number; address: string };
  droneLocation?: { lat: number; lng: number };
}

export const OrderMapTracking = ({ 
  pickupLocation, 
  deliveryDestination,
  droneLocation 
}: MapTrackingProps) => {
  // Initialize Mapbox
  // Add pickup marker (nhà hàng - màu xanh)
  // Add delivery marker (khách hàng - màu đỏ)
  // Add drone marker (nếu có - màu vàng)
  // Draw route line
  // Auto-fit bounds
};
```

### 3. Drone Service - Get Nearby Drones

**API Endpoint:**
```typescript
// GET /drones/nearby?lat={restaurantLat}&lng={restaurantLng}&radius=5
// Response:
{
  "success": true,
  "data": [
    {
      "droneId": "drone-uuid",
      "name": "Drone #001",
      "status": "IDLE",
      "currentLocation": {
        "lat": 10.776000,
        "lng": 106.703000
      },
      "distance": 0.8, // km
      "battery": 85,
      "maxPayload": 5 // kg
    }
  ]
}
```

## Migration Status

✅ Order Service Schema updated
✅ Order Service Controller updated
✅ Order Service Validation updated
✅ Restaurant Service Kafka Consumer updated
✅ Restaurant Service Controller updated
✅ Frontend CheckoutPage updated

⚠️ **CẦN CHẠY:**
- `npx prisma migrate dev` trong order-service
- `npx prisma generate` trong order-service
- Restart các services

🔜 **BƯỚC TIẾP THEO:**
- Socket Service: Subscribe ORDER_READY_FOR_PICKUP event
- Admin Dashboard: Implement map tracking component
- Drone Service: Implement nearby drones API
- Admin Dashboard: Implement drone assignment flow

## Lưu ý quan trọng

1. **Tọa độ bắt buộc**: Frontend phải đảm bảo `customerLatitude` và `customerLongitude` luôn được gửi khi tạo order (validate ở Address selection)

2. **Store coordinates**: Tất cả Store phải có `latitude` và `longitude` (admin merchant cần cập nhật khi tạo store)

3. **Error handling**: Nếu không có tọa độ, order vẫn được tạo nhưng không thể assign drone

4. **Privacy**: Chỉ admin và merchant có quyền xem tọa độ chính xác khách hàng

5. **Real-time updates**: Drone location cần được update real-time qua WebSocket (socket-service)

---

**Ngày cập nhật:** 2025-11-24
**Version:** 1.0.0

