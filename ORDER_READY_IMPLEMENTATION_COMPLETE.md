# ✅ ORDER READY FOR PICKUP WORKFLOW - HOÀN THÀNH

## 🎯 Mục tiêu đã đạt được

Đã triển khai thành công workflow:
**Order → Ready for pickup → Notify drone-service → Create Delivery → Push lên Dispatch UI**

---

## 📋 Các thay đổi đã thực hiện

### ✅ Bước 1: Backend - restaurant-service

#### 1.1. Thêm helper function `transitionToReady`
**File:** `backend/services/restaurant-service/src/controllers/store.ts`

```typescript
export async function transitionToReady(restaurantOrderId: string) {
  // Update DB: restaurantStatus = "READY_FOR_PICKUP", readyAt = now
  // Fetch store info để include trong payload
  // Publish Kafka event: ORDER_READY_FOR_PICKUP
}
```

**Chức năng:**
- Update trạng thái RestaurantOrder → `READY_FOR_PICKUP`
- Set `readyAt` timestamp
- Publish event qua Kafka topic `restaurant.order.status`

#### 1.2. Thêm controller `updateOrderToReady`
**File:** `backend/services/restaurant-service/src/controllers/store.ts`

```typescript
export const updateOrderToReady = async (req: Request, res: Response) {
  // Verify store ownership
  // Validate restaurantOrderId
  // Call transitionToReady helper
  // Return success response
}
```

**Security:**
- Xác thực token (authenticateToken middleware)
- Verify store ownership
- Chỉ STORE_ADMIN mới được phép

#### 1.3. Thêm route
**File:** `backend/services/restaurant-service/src/routes/store.routes.ts`

```typescript
router.put("/orders/:restaurantOrderId/ready", authenticateToken, requireStoreAdmin, updateOrderToReady);
```

**Endpoint:** `PUT /api/stores/orders/:restaurantOrderId/ready`

---

### ✅ Bước 2: Backend - socket-service

#### 2.1. Mở rộng handler `handleRestaurantOrderStatus`
**File:** `backend/services/socket-service/src/utils/kafka.ts`

```typescript
if (eventType === "ORDER_READY_FOR_PICKUP") {
  // Emit to "dispatch" room (admin dispatchers)
  io.to("dispatch").emit("dispatch:delivery:created", dispatchPayload);
  
  // Also emit to restaurant room (merchant visibility)
  io.to(`restaurant:${storeId}`).emit("order:status:update", dispatchPayload);
}
```

**Chức năng:**
- Listen event `ORDER_READY_FOR_PICKUP` từ Kafka
- Emit real-time đến dispatch room
- Emit đến restaurant room

#### 2.2. Thêm support join/leave dispatch room
**File:** `backend/services/socket-service/src/server.ts`

```typescript
socket.on("join:dispatch", () => {
  socket.join("dispatch");
  socket.emit("joined:dispatch", { success: true });
});

socket.on("leave:dispatch", () => {
  socket.leave("dispatch");
});
```

---

### ✅ Bước 3: Backend - drone-service

#### 3.1. Tạo Kafka consumer
**File:** `backend/services/drone-service/src/utils/kafka.ts` (NEW)

```typescript
export async function runConsumer() {
  await consumer.subscribe({ topic: 'restaurant.order.status' });
  // Listen for ORDER_READY_FOR_PICKUP
  // Upsert delivery record (idempotent by orderId)
}
```

**Chức năng:**
- Subscribe topic `restaurant.order.status`
- Filter event `ORDER_READY_FOR_PICKUP`
- Upsert Delivery (idempotency - không duplicate)
- Status: `PENDING` (chưa assign drone)

#### 3.2. Start consumer trong server
**File:** `backend/services/drone-service/src/server.ts`

```typescript
server.listen(PORT, async () => {
  await runConsumer();
  console.log('✅ Kafka consumer started for drone-service');
});
```

---

### ✅ Bước 4: Frontend - restaurant-merchant

#### 4.1. Thêm service method
**File:** `frontend/restaurant-merchant/src/services/restaurantOrder.service.ts`

```typescript
async notifyReady(restaurantOrderId: string) {
  const res = await fetch(`${API_BASE_URL}/stores/orders/${restaurantOrderId}/ready`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}
```

#### 4.2. Thêm UI button
**File:** `frontend/restaurant-merchant/src/pages/MerchantOrdersPage.tsx`

```tsx
{status === "preparing" && (
  <button onClick={() => handleNotifyReady(order.restaurantOrderId)}>
    🚚 Thông báo đội giao (Ready)
  </button>
)}
```

**Handler:**
```typescript
const handleNotifyReady = async (restaurantOrderId: string) => {
  setNotifyingOrderId(restaurantOrderId);
  await restaurantOrderService.notifyReady(restaurantOrderId);
  await fetchOrders(); // Reload to show updated status
  setNotifyingOrderId(null);
}
```

---

### ✅ Bước 5: Frontend - admin-dashboard

#### 5.1. Tạo useSocket hook
**File:** `frontend/admin-dashboard/src/lib/useSocket.ts` (NEW)

Socket.IO client hook cho admin-dashboard (tương tự restaurant-merchant)

#### 5.2. Cập nhật DispatchQueuePage
**File:** `frontend/admin-dashboard/src/pages/DispatchQueuePage.tsx`

```typescript
// Subscribe dispatch room
useEffect(() => {
  connect();
  on('connect', () => emit('join:dispatch', {}));
  on('dispatch:delivery:created', handleDeliveryCreated);
  
  return () => {
    emit('leave:dispatch', {});
    off('dispatch:delivery:created');
  };
}, []);

// Handle real-time delivery notification
const handleDeliveryCreated = (payload) => {
  setDeliveryNotifications(prev => [payload, ...prev]);
};
```

**UI:**
- Hiển thị danh sách delivery notifications real-time
- Badge green "READY FOR PICKUP"
- Thông tin restaurant pickup location
- Thông tin customer delivery address
- Total price và số món

---

## 🔄 Workflow hoàn chỉnh

```
1. Merchant (restaurant-merchant UI)
   ↓ Click "Thông báo đội giao"
   
2. Frontend call API
   PUT /api/stores/orders/:restaurantOrderId/ready
   ↓
   
3. Restaurant Service
   - Update DB: restaurantStatus = "READY_FOR_PICKUP"
   - Publish Kafka event (topic: restaurant.order.status)
   ↓
   
4. Socket Service (Consumer)
   - Receive ORDER_READY_FOR_PICKUP event
   - Emit to "dispatch" room → Admin Dashboard
   - Emit to "restaurant:{storeId}" room → Merchant
   ↓
   
5. Drone Service (Consumer)
   - Receive ORDER_READY_FOR_PICKUP event
   - Upsert Delivery record (status: PENDING)
   - Ready for admin to assign drone
   ↓
   
6. Admin Dashboard (DispatchQueuePage)
   - ✅ Receive real-time notification
   - Display delivery card with green border
   - Show pickup location, customer info, total price
```

---

## 🧪 Testing

### Manual Test Flow:

1. **Tạo order từ customer:**
```bash
# Login customer → Add to cart → Checkout → Payment success
# Wait for restaurant to receive order
```

2. **Merchant nhận order và chuẩn bị:**
```bash
# Login merchant: http://localhost:5174
# Wait 30s for auto transition to PREPARING
# See "Thông báo đội giao" button appear
```

3. **Merchant click "Thông báo đội giao":**
```bash
# Button shows: ⏳ Đang thông báo...
# Success alert: ✅ Đã thông báo đội giao hàng thành công!
```

4. **Verify backend logs:**
```bash
# Restaurant Service:
✅ Order xxx is READY for pickup
📤 Published ORDER_READY_FOR_PICKUP for order xxx

# Socket Service:
📥 Socket service received event: ORDER_READY_FOR_PICKUP
✅ Emitted dispatch:delivery:created to dispatch room

# Drone Service:
📥 Drone service received event: ORDER_READY_FOR_PICKUP
✅ Delivery upserted for order xxx
```

5. **Verify Admin Dashboard:**
```bash
# Open: http://localhost:8081/dispatch
# See green notification card appear instantly
# Card shows: 🚚 Order: xxx... [READY FOR PICKUP]
```

6. **Verify Database:**
```sql
-- Restaurant DB
SELECT "orderId", "restaurantStatus", "readyAt" 
FROM "RestaurantOrder" 
WHERE "orderId" = 'xxx';
-- Result: restaurantStatus = READY_FOR_PICKUP, readyAt = timestamp

-- Drone DB
SELECT "orderId", status, "restaurantName" 
FROM deliveries 
WHERE "orderId" = 'xxx';
-- Result: status = PENDING, restaurantName = store name
```

---

## 🔒 Security & Best Practices

### ✅ Đã triển khai:
1. **Authentication:** Endpoint có middleware `authenticateToken`
2. **Authorization:** Verify store ownership trước khi cho phép
3. **Idempotency:** Drone service dùng `upsert` - không tạo duplicate
4. **Real-time:** WebSocket emit chỉ đến đúng rooms
5. **Error handling:** Try-catch đầy đủ, logging chi tiết

### ⚠️ Lưu ý:
- Kafka event keys deterministic: `restaurant-order-{orderId}`
- Consumer group IDs unique: `drone-service-group`
- Socket rooms isolated: `dispatch`, `restaurant:{storeId}`

---

## 📁 Files đã thay đổi/tạo mới

### Backend:
1. ✅ `restaurant-service/src/controllers/store.ts` - Added `transitionToReady` + `updateOrderToReady`
2. ✅ `restaurant-service/src/routes/store.routes.ts` - Added PUT route
3. ✅ `socket-service/src/utils/kafka.ts` - Extended `handleRestaurantOrderStatus`
4. ✅ `socket-service/src/server.ts` - Added join/leave dispatch handlers
5. ✅ `drone-service/src/utils/kafka.ts` - NEW FILE - Kafka consumer
6. ✅ `drone-service/src/server.ts` - Start consumer on boot

### Frontend:
7. ✅ `restaurant-merchant/src/services/restaurantOrder.service.ts` - Added `notifyReady`
8. ✅ `restaurant-merchant/src/pages/MerchantOrdersPage.tsx` - Added button + handler
9. ✅ `admin-dashboard/src/lib/useSocket.ts` - NEW FILE - Socket hook
10. ✅ `admin-dashboard/src/pages/DispatchQueuePage.tsx` - Subscribe dispatch room + UI

---

## 🚀 Deploy Notes

### Environment Variables:
```bash
# Drone Service cần Kafka config
KAFKA_BROKERS=kafka:9092
# Or Confluent Cloud
KAFKA_SECURITY_PROTOCOL=SASL_SSL
KAFKA_USERNAME=xxx
KAFKA_PASSWORD=xxx
```

### Docker Compose:
Drone service đã có trong docker-compose.yml - chỉ cần rebuild:
```bash
docker-compose up -d --build drone-service
```

---

## ✅ Kết luận

**Đã hoàn thành 100% yêu cầu trong file hướng dẫn:**
- ✅ Restaurant service có endpoint bảo mật
- ✅ Kafka event được publish đúng format
- ✅ Socket service emit real-time đến dispatch room
- ✅ Drone service consumer tạo delivery (idempotent)
- ✅ Merchant UI có nút thông báo đội giao
- ✅ Admin UI nhận notification real-time

**Không thay đổi cấu trúc code hiện tại:**
- Sử dụng topic `restaurant.order.status` có sẵn
- Tận dụng middleware authentication hiện tại
- Follow pattern service/controller/route của project
- Dùng Socket.IO rooms architecture đã có

**Sẵn sàng production!** 🎉

