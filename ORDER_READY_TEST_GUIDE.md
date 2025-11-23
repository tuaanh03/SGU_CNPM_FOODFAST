# 🧪 Test ORDER READY FOR PICKUP Workflow

## Prerequisites
- All services running (docker-compose up -d)
- Merchant logged in (STORE_ADMIN role)
- Admin logged in (SYSTEM_ADMIN role)
- At least one order in PREPARING status

---

## Test Case 1: Merchant Notify Ready

### Step 1: Merchant UI - Find preparing order
```
URL: http://localhost:5174
Navigate: Dashboard → Orders → Tab "Đã xác nhận"
Expected: See orders with status "Đang chuẩn bị"
UI: Yellow badge, message "👨‍🍳 Đang chuẩn bị món ăn..."
UI: Button "🚚 Thông báo đội giao (Ready)"
```

### Step 2: Click notify button
```
Action: Click "🚚 Thông báo đội giao (Ready)"
Expected: 
- Button text changes: "⏳ Đang thông báo..."
- Button disabled during request
- Alert shows: "✅ Đã thông báo đội giao hàng thành công!"
```

### Step 3: Verify Restaurant Service logs
```bash
docker logs restaurant-service --tail 20

Expected output:
✅ Order xxx is READY for pickup
📤 Published ORDER_READY_FOR_PICKUP for order xxx
```

---

## Test Case 2: Socket Service Real-time Emit

### Step 1: Check Socket Service logs
```bash
docker logs socket-service --tail 30

Expected output:
📥 Socket service received event from topic restaurant.order.status
✅ Emitted dispatch:delivery:created to dispatch room - order xxx
✅ Emitted order:status:update to restaurant:xxx - Ready for pickup
```

---

## Test Case 3: Drone Service Create Delivery

### Step 1: Check Drone Service logs
```bash
docker logs drone-service --tail 30

Expected output:
📥 Drone service received event: ORDER_READY_FOR_PICKUP
✅ Delivery upserted for order xxx: delivery-id-xxx
```

### Step 2: Verify Drone DB
```bash
docker exec -it drone-db psql -U postgres -d foodfast_drone

\c foodfast_drone
SELECT "orderId", status, "restaurantName", "restaurantAddress", "customerName" 
FROM deliveries 
WHERE "orderId" = 'YOUR_ORDER_ID' 
ORDER BY "createdAt" DESC 
LIMIT 1;

Expected result:
orderId        | status  | restaurantName | restaurantAddress | customerName
-----------------------------------------------------------------------------
xxx-xxx-xxx... | PENDING | Store Name     | 123 Address...    | Customer

Exit: \q
```

---

## Test Case 4: Admin Dashboard Real-time Notification

### Step 1: Open Admin Dashboard
```
URL: http://localhost:8081/dispatch
Login: SYSTEM_ADMIN account
Expected: Dispatch Queue page loads
```

### Step 2: Open Browser Console
```javascript
// Check socket connection
console.log('Socket connected:', /* check connection status */);

// Should see logs:
✅ Socket connected: socket-id-xxx
🔌 Dispatch queue connected to socket
✅ Joined dispatch room: { success: true }
```

### Step 3: Trigger notification (from another merchant)
```
From merchant UI → Click "Thông báo đội giao"
```

### Step 4: Verify Admin UI update
```
Expected (INSTANT):
- New green card appears at top
- Border: green (2px)
- Badge: "READY FOR PICKUP"
- Content shows:
  * Order ID (truncated)
  * Ready timestamp
  * Restaurant name + address
  * Customer delivery address
  * Total price
  * Number of items

Console log:
🚚 New delivery notification: { orderId: xxx, ... }
```

---

## Test Case 5: Idempotency Test

### Step 1: Click notify button TWICE rapidly
```
Action: Click "Thông báo đội giao" button 2 times quickly
Expected:
- First click: Success
- Second click: Still success (idempotent)
```

### Step 2: Check Drone DB
```sql
SELECT COUNT(*) FROM deliveries WHERE "orderId" = 'YOUR_ORDER_ID';

Expected result: 1 (not 2!)
```

---

## Test Case 6: API Direct Test

### Step 1: Get auth token
```bash
# Login as STORE_ADMIN
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@example.com",
    "password": "yourpassword"
  }'

# Save token from response
TOKEN="eyJhbGci..."
```

### Step 2: Get restaurant order ID
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/stores/my/orders

# Pick a PREPARING order's restaurantOrderId (not orderId!)
RESTAURANT_ORDER_ID="uuid-xxx-xxx..."
```

### Step 3: Call ready endpoint
```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/stores/orders/$RESTAURANT_ORDER_ID/ready

Expected response:
{
  "success": true,
  "message": "Đã thông báo đội giao hàng (Ready for pickup)",
  "data": {
    "restaurantOrderId": "xxx",
    "status": "READY_FOR_PICKUP"
  }
}
```

### Step 4: Verify Restaurant DB
```bash
docker exec -it restaurant-db psql -U postgres -d foodfast_restaurant

SELECT "orderId", "restaurantStatus", "readyAt" 
FROM "RestaurantOrder" 
WHERE id = 'YOUR_RESTAURANT_ORDER_ID';

Expected:
restaurantStatus | readyAt
---------------------------------
READY_FOR_PICKUP | 2025-11-22 ...
```

---

## Test Case 7: Error Handling

### Test 7.1: Invalid restaurantOrderId
```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/stores/orders/invalid-id-123/ready

Expected: 404
{ "success": false, "message": "Không tìm thấy đơn hàng" }
```

### Test 7.2: Wrong store owner
```bash
# Login as different merchant
# Try to update other store's order

Expected: 403
{ "success": false, "message": "Không có quyền truy cập đơn hàng này" }
```

### Test 7.3: No authentication
```bash
curl -X PUT http://localhost:3000/api/stores/orders/xxx/ready

Expected: 401
{ "success": false, "message": "Unauthorized" }
```

---

## Test Case 8: Socket Reconnection

### Step 1: Stop socket-service
```bash
docker stop socket-service
```

### Step 2: Check Admin UI
```
Expected:
- Red dot appears (disconnected)
- Console: ❌ Socket disconnected: transport close
```

### Step 3: Restart socket-service
```bash
docker start socket-service
```

### Step 4: Verify reconnection
```
Expected:
- Green dot returns (connected)
- Console: ✅ Socket connected: new-socket-id
- Console: ✅ Joined dispatch room: { success: true }
```

---

## Performance Test

### Load Test: Multiple merchants clicking ready
```bash
# Use Apache Bench or k6
ab -n 100 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  -m PUT \
  http://localhost:3000/api/stores/orders/$ID/ready

Expected:
- All requests succeed or fail gracefully
- No duplicate deliveries in DB
- All dispatch notifications arrive
```

---

## Checklist

- [ ] Merchant can click "Thông báo đội giao" button
- [ ] Button shows loading state during request
- [ ] Success alert appears after completion
- [ ] Restaurant service publishes Kafka event
- [ ] Socket service emits to dispatch room
- [ ] Drone service creates delivery record
- [ ] Admin dashboard receives real-time notification
- [ ] UI shows green card with delivery info
- [ ] Idempotency: No duplicate deliveries
- [ ] Security: Only authorized merchants can notify
- [ ] Error handling: Invalid IDs return proper errors
- [ ] Socket reconnection works automatically

---

## Common Issues & Solutions

### Issue 1: Button không hiển thị
**Причина:** Order status không phải PREPARING
**Solution:** Đợi 30s sau khi order được confirmed (auto transition)

### Issue 2: Admin không nhận notification
**Причина:** Socket không join dispatch room
**Solution:** Check console logs, verify socket connected và joined

### Issue 3: Duplicate deliveries trong DB
**Причина:** Upsert không hoạt động đúng
**Solution:** Verify orderId là unique constraint trong Prisma schema

### Issue 4: Kafka consumer không chạy
**Причина:** Kafka connection failed
**Solution:** Check KAFKA_BROKERS environment variable
```bash
docker logs drone-service | grep Kafka
```

---

**✅ All tests passed = Implementation successful!**

