Mục tiêu

Thêm workflow "Order → Ready for pickup → Notify drone-service → Create Delivery → Push lên Dispatch UI" mà KHÔNG thay đổi cấu trúc project hiện tại.

Tóm tắt ý tưởng (ngắn):
- Khi merchant báo "Ready" cho một RestaurantOrder, gọi endpoint backend (restaurant-service)
- Backend cập nhật trường `restaurantStatus` -> `READY_FOR_PICKUP` và `readyAt`
- Backend publish một event Kafka (topic có sẵn `restaurant.order.status`) với eventType = `ORDER_READY_FOR_PICKUP` (payload chuẩn)
- `drone-service` (mới/đã cập nhật) có một Kafka consumer, lắng nghe topic `restaurant.order.status` và xử lý event `ORDER_READY_FOR_PICKUP` để tạo/ghi delivery record (idempotent)
- `socket-service` đã subscribe `restaurant.order.status` — mở rộng handler để khi nhận `ORDER_READY_FOR_PICKUP` sẽ emit đến room dispatch (ví dụ `dispatch`) và/hoặc `restaurant:{storeId}` để UI merchant & admin thấy
- `admin-dashboard` (DispatchQueuePage) subscribe websocket room `dispatch` và hiển thị delivery mới realtime

Yêu cầu và nguyên tắc
- Không phá vỡ cấu trúc code hiện có
- Dùng topic `restaurant.order.status` (đã có ở repo) để tận dụng consumer hiện tại
- Idempotency: xử lý event nhiều lần không tạo duplicate delivery (upsert by orderId)
- Bảo mật: endpoint merchant gọi phải authenticate (reuse middleware hiện có)
- Hướng dẫn các file cần sửa, snippet kèm nơi chèn (không tự động sửa)

Checklist (những bước cần làm)
1. Backend - restaurant-service
   - [ ] Thêm helper controller `transitionToReady(restaurantOrderId: string)`
   - [ ] Thêm API endpoint (protected) để merchant trigger `READY_FOR_PICKUP` (ví dụ: `PUT /stores/orders/:restaurantOrderId/ready`)
   - [ ] Khi update DB -> publish Kafka event via existing `publishRestaurantOrderStatusEvent` với payload chuẩn
2. Backend - drone-service
   - [ ] Thêm Kafka consumer (groupId e.g. `drone-service-group`) subscribe `restaurant.order.status`
   - [ ] Khi nhận event `ORDER_READY_FOR_PICKUP` → upsert Delivery in DB (use prisma.upsert by orderId)
   - [ ] (Optional) Publish internal event `delivery.created` (topic) if needed
3. Backend - socket-service
   - [ ] Mở rộng handler `handleRestaurantOrderStatus` để detect `ORDER_READY_FOR_PICKUP` và emit `dispatch:delivery:created` to `dispatch` room
   - [ ] Ensure the payload to socket contains delivery summary (orderId, storeId, restaurantName, restaurantLat/Lng, customer info, etc.)
4. Frontend - restaurant-merchant
   - [ ] Thêm nút "Thông báo đội giao" trên `MerchantOrdersPage.tsx` khi `status === 'preparing'` (UI: small button)
   - [ ] Khi click, call new API `PUT /api/stores/orders/:id/ready` (via `restaurantOrder.service`) and show feedback
5. Frontend - admin-dashboard (DispatchQueuePage)
   - [ ] Subscribe socket room `dispatch` (use existing `useSocket` helper) và lắng nghe `dispatch:delivery:created`
   - [ ] Khi nhận event, thêm vào state queue để hiển thị realtime
6. Testing
   - [ ] Manual: Create order → wait confirmed → ensure restaurant receives via socket → merchant clicks Ready → check drone-service DB has delivery and admin dispatch UI shows it
   - [ ] Add curl examples


------------------------
Chi tiết kỹ thuật (mỗi bước kèm snippet)

1) restaurant-service: thêm helper `transitionToReady` và route

- File: `backend/services/restaurant-service/src/controllers/store.ts`

Vị trí: cùng nơi `transitionToPreparing` hiện có (ở cuối file). Thêm hàm:

```ts
// ...existing code...
export async function transitionToReady(restaurantOrderId: string) {
  const updated = await prisma.restaurantOrder.update({
    where: { id: restaurantOrderId },
    data: {
      restaurantStatus: "READY_FOR_PICKUP",
      readyAt: new Date(),
    },
  });

  console.log(`✅ Order ${updated.orderId} is READY for pickup`);

  // Publish event to Kafka (reuse publisher in utils/kafka.ts)
  const { publishRestaurantOrderStatusEvent } = require('../utils/kafka');
  try {
    await publishRestaurantOrderStatusEvent({
      eventType: 'ORDER_READY_FOR_PICKUP',
      orderId: updated.orderId,
      storeId: updated.storeId,
      readyAt: new Date().toISOString(),
      pickupLocation: {
        storeId: updated.storeId,
        // optionally include address/lat/lng
      },
    });
    console.log(`📤 Published ORDER_READY_FOR_PICKUP for order ${updated.orderId}`);
  } catch (err) {
    console.error('Error publishing ORDER_READY_FOR_PICKUP:', err);
  }
}
```

- File: `backend/services/restaurant-service/src/routes/store.routes.ts`

Thêm route bảo mật (STORE_ADMIN) => gọi controller mới

```ts
// ...existing code...
router.put('/orders/:restaurantOrderId/ready', authenticateToken, requireStoreAdmin, updateOrderToReady);
```

Và trong `controllers/store.ts` export `updateOrderToReady`:

```ts
export const updateOrderToReady = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { restaurantOrderId } = req.params;

    // xác thực store ownership
    const store = await prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) return res.status(404).json({ success: false, message: 'Bạn chưa có cửa hàng' });

    const ro = await prisma.restaurantOrder.findUnique({ where: { id: restaurantOrderId } });
    if (!ro) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn' });
    if (ro.storeId !== store.id) return res.status(403).json({ success: false, message: 'No permission' });

    // Call helper
    await transitionToReady(restaurantOrderId);

    res.json({ success: true, message: 'Đã thông báo đội giao (Ready for pickup)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
```

Ghi chú: sử dụng `publishRestaurantOrderStatusEvent` (đã tồn tại) để publish tới topic `restaurant.order.status`. Chúng ta gửi `eventType: 'ORDER_READY_FOR_PICKUP'` trong payload; các consumer sẽ switch theo eventType.


2) socket-service: emit thêm cho dispatch

- File: `backend/services/socket-service/src/utils/kafka.ts`

Tìm `handleRestaurantOrderStatus` hiện có. Mở rộng để nếu `eventType === 'ORDER_READY_FOR_PICKUP'` thì emit tới room `dispatch` (global for dispatchers) và `restaurant:{storeId}`:

```ts
if (eventType === 'ORDER_READY_FOR_PICKUP') {
  const dispatchPayload = {
    orderId,
    storeId,
    restaurantStatus: 'READY_FOR_PICKUP',
    readyAt: data.readyAt,
    pickupLocation: data.pickupLocation
  };

  // Emit to dispatchers
  io.to('dispatch').emit('dispatch:delivery:created', dispatchPayload);
  socketEmitCounter.inc({ event_name: 'dispatch:delivery:created' });
  console.log(`✅ Emitted dispatch:delivery:created to dispatch - order ${orderId}`);

  // Also emit to restaurant room (optional)
  if (storeId) io.to(`restaurant:${storeId}`).emit('order:status:update', dispatchPayload);
}
```


3) drone-service: add Kafka consumer to create Delivery

- File (new): `backend/services/drone-service/src/utils/kafka.ts` (or integrate into existing if any)

Minimal snippet (Kafkajs):

```ts
import { Kafka } from 'kafkajs';
import prisma from '../lib/prisma';

const kafka = new Kafka({ clientId: 'drone-service', brokers: process.env.KAFKA_BROKERS.split(',') });
const consumer = kafka.consumer({ groupId: 'drone-service-group' });

export async function runConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'restaurant.order.status', fromBeginning: false });

  await consumer.run({ eachMessage: async ({ topic, message }) => {
    const data = JSON.parse(message.value.toString());
    if (data.eventType === 'ORDER_READY_FOR_PICKUP') {
      const { orderId, storeId, readyAt, pickupLocation } = data;

      // Idempotent upsert delivery by orderId
      const delivery = await prisma.delivery.upsert({
        where: { orderId },
        update: {
          status: 'ASSIGNED', // or PENDING depending flow
          assignedAt: new Date(),
          restaurantName: '',
          restaurantLat: pickupLocation?.lat || null,
          restaurantLng: pickupLocation?.lng || null,
        },
        create: {
          orderId,
          droneId: '', // leave empty so admin can assign, or find available drone
          restaurantName: '',
          restaurantLat: pickupLocation?.lat || null,
          restaurantLng: pickupLocation?.lng || null,
          customerName: '',
          customerPhone: '',
          customerLat: null,
          customerLng: null,
          customerAddress: '',
          distance: 0,
          estimatedTime: 0,
          status: 'ASSIGNED',
        }
      });

      console.log('Delivery upserted for', orderId, delivery.id);
    }
  }});
}

// Call runConsumer() from drone-service server startup
```

Ghi chú: cách xử lý drone assignment - 2 lựa chọn:
- Auto assign: drone-service tìm một drone `AVAILABLE` và assign ngay
- Manual assign: tạo delivery với `droneId` null, dispatcher trên admin-dashboard sẽ assign

Khuyến nghị: ban đầu tạo delivery WITHOUT assignment (droneId empty) → dispatcher điều phối trong UI.


4) frontend - restaurant-merchant: thêm nút Notify Drone

- File: `frontend/restaurant-merchant/src/pages/MerchantOrdersPage.tsx`

Thêm một nút nhỏ xuất hiện khi order status là `preparing`:

```tsx
{status === 'preparing' && (
  <div className="pt-4 border-t">
    <Button onClick={() => notifyReady(order.restaurantOrderId)} className="w-full bg-indigo-600">
      🚚 Thông báo đội giao (Ready for pickup)
    </Button>
  </div>
)}
```

Add function trong `restaurantOrder.service.ts`:

```ts
async notifyReady(restaurantOrderId: string) {
  const token = authService.getToken('STORE_ADMIN');
  const res = await fetch(`${API_BASE_URL}/stores/orders/${restaurantOrderId}/ready`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });
  return res.json();
}
```


5) frontend - admin-dashboard DispatchQueuePage: subscribe to `dispatch` room

- Add a small socket hook (reuse existing `useSocket`), join room `dispatch` in `useEffect` on connect, listen `dispatch:delivery:created` and update `orders` state

Snippet:

```ts
useEffect(() => {
  connect();
  on('connect', () => {
    emit('join:dispatch', {}); // backend socket-service should accept this join
  });

  on('dispatch:delivery:created', (payload) => {
    setOrders(prev => [payload, ...prev]);
  });

  return () => {
    off('dispatch:delivery:created');
    off('connect');
    emit('leave:dispatch', {});
  }
}, []);
```

Note: socket-service must implement server-side support for `join:dispatch` (it currently supports join:restaurant & join:order). Add minimal handler in `socket-service/src/server.ts`:

```ts
// in io.on('connection'...)
socket.on('join:dispatch', () => {
  socket.join('dispatch');
  socket.emit('joined:dispatch', { success: true });
});
socket.on('leave:dispatch', () => socket.leave('dispatch'));
```


6) Testing & Validation

Manual test plan (short):
- Start all services + Kafka
- Create a test order end-to-end (customer -> order-service -> publish ORDER_CONFIRMED)
- Ensure restaurant-merchant receives order via socket
- Merchant clicks "Thông báo đội giao" (Ready)
- Check restaurant-service logs: updated restaurantOrder and published ORDER_READY_FOR_PICKUP
- Check drone-service logs / DB: delivery created/upserted
- Check socket-service logs: emitted `dispatch:delivery:created` to `dispatch` room
- Open admin-dashboard (dispatch page) and verify new delivery appears realtime

Curl examples

- Simulate merchant calling ready endpoint:
```bash
curl -X PUT \
  -H "Authorization: Bearer {merchant_token}" \
  http://localhost:3000/api/stores/orders/{restaurantOrderId}/ready
```

- Simulate Kafka event (manual test) - publish via kafka producer tool / kafka console
```json
{
  "eventType": "ORDER_READY_FOR_PICKUP",
  "orderId": "8d66ead0-...",
  "storeId": "store-123",
  "readyAt": "2025-11-22T...",
  "pickupLocation": { "lat": 10.7626, "lng": 106.6601, "address": "123 Nguyen Hue" }
}
```


7) Security & Idempotency notes
- Use `prisma.upsert` in drone-service to avoid duplicate delivery creation
- Verify merchant ownership of store before allowing trigger
- Keep Kafka event keys deterministic (e.g. `restaurant-order-{orderId}`) to help brokers compact


8) Files to change (summary)
- backend/services/restaurant-service/src/controllers/store.ts  (add transitionToReady + controller)
- backend/services/restaurant-service/src/routes/store.routes.ts (add route)
- backend/services/socket-service/src/utils/kafka.ts (extend handleRestaurantOrderStatus)
- backend/services/socket-service/src/server.ts (support join:dispatch)
- backend/services/drone-service/src/server.ts (start consumer or call runConsumer in startup)
- backend/services/drone-service/src/utils/kafka.ts (new file: consumer and handler to upsert delivery)
- frontend/restaurant-merchant/src/services/restaurantOrder.service.ts (add notifyReady)
- frontend/restaurant-merchant/src/pages/MerchantOrdersPage.tsx (add button call)
- frontend/admin-dashboard/src/pages/DispatchQueuePage.tsx (subscribe to socket room `dispatch`)


Kết luận / Next steps
1. Nếu bạn muốn, tôi có thể áp dụng những thay đổi nhỏ này trực tiếp vào repo (tạo helper function, routes, kafka consumer in drone-service, and UI button) — nhưng cần xác nhận bạn muốn tôi làm code edits ngay.
2. Nếu không, bạn có thể copy-paste các snippet vào vị trí tương ứng theo hướng dẫn ở trên.

Công cụ nào có thể thực hiện?  
- Tôi (agent) có công cụ để sửa file trong repo và chạy build (đã làm nhiều lần ở session này). Tôi có thể thực hiện các thay đổi mã và test build/container.  

Bạn muốn tôi tiếp tục và thực hiện các thay đổi trên (thêm `transitionToReady`, route, socket emit, drone-service consumer, UI button), hay chỉ cần hướng dẫn để bạn tự làm?  

(Theo nguyên tắc của bạn: tôi sẽ không tự ý thay đổi cấu trúc lớn; mọi thay đổi tôi thực hiện sẽ theo các file đề xuất ở trên.)

