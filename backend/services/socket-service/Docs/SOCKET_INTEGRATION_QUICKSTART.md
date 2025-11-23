# 🚀 Quick Start Guide - Socket.IO Integration

## 📦 Cài đặt Dependencies

### Frontend - Customer (cnpm-fooddelivery)
```bash
cd frontend/cnpm-fooddelivery
npm install socket.io-client
```

### Frontend - Restaurant (restaurant-merchant)
```bash
cd frontend/restaurant-merchant
npm install socket.io-client
```

## 🔧 Cấu hình Environment Variables

### Local Development
```env
# .env
VITE_SOCKET_URL=http://localhost:3011
```

### Docker
```env
# .env
VITE_SOCKET_URL=http://localhost:3011
```

### Production/Deploy
```env
# .env
VITE_SOCKET_URL=https://your-socket-service-url.com
```

## 📝 Cách sử dụng

### 1. Customer - Theo dõi đơn hàng (Order Tracking)

File đã tích hợp: `frontend/cnpm-fooddelivery/src/components/OngoingOrders.tsx`

```typescript
import { useOrderTracking } from "@/lib/useOrderTracking";

// Trong component
const [orderId, setOrderId] = useState<string | null>(null);
const { orderStatus, isConnected } = useOrderTracking(orderId);

// Xử lý cập nhật status
useEffect(() => {
  if (orderStatus) {
    console.log('Status updated:', orderStatus.restaurantStatus);
    // CONFIRMED → PREPARING → READY → DELIVERING → COMPLETED
  }
}, [orderStatus]);
```

### 2. Restaurant - Nhận đơn mới (New Orders)

File đã tích hợp: `frontend/restaurant-merchant/src/pages/MerchantOrdersPage.tsx`

```typescript
import { useRestaurantOrders } from "@/lib/useRestaurantOrders";

// Trong component
const [storeId, setStoreId] = useState<string | null>(null);
const { lastOrder, newOrders, isConnected } = useRestaurantOrders(storeId);

// Xử lý đơn hàng mới
useEffect(() => {
  if (lastOrder) {
    console.log('New order received:', lastOrder);
    // Show notification, play sound, update UI
  }
}, [lastOrder]);
```

## 🎯 Testing

### 1. Start Backend Services
```bash
# Terminal 1: Order Service
cd backend/services/order-service
npm start

# Terminal 2: Restaurant Service
cd backend/services/restaurant-service
npm start

# Terminal 3: Socket Service
cd backend/services/socket-service
npm install  # Lần đầu
npm start

# Terminal 4: Payment Service
cd backend/services/payment-service
npm start
```

### 2. Start Frontend
```bash
# Terminal 5: Customer Frontend
cd frontend/cnpm-fooddelivery
npm run dev

# Terminal 6: Restaurant Frontend
cd frontend/restaurant-merchant
npm run dev
```

### 3. Test Flow

**Customer:**
1. Mở http://localhost:5173
2. Đăng nhập → Đặt món → Thanh toán
3. Vào "Đơn hàng của tôi" → Xem real-time tracking
4. Sẽ thấy badge "Live" và status tự động update

**Restaurant:**
1. Mở http://localhost:5174
2. Đăng nhập merchant
3. Vào "Quản lý đơn hàng"
4. Sẽ thấy indicator "Real-time" màu xanh
5. Khi có đơn mới → notification xuất hiện ngay lập tức

## 🔍 Debug

### Check Socket Connection
```javascript
// Browser Console - Customer
console.log('Socket connected:', isConnected);
console.log('Tracking order:', trackingOrderId);

// Browser Console - Restaurant
console.log('Socket connected:', isConnected);
console.log('Store ID:', storeId);
```

### Check Socket Service Health
```bash
curl http://localhost:3011/health

# Expected response:
# {
#   "success": true,
#   "connections": 2,  # Số lượng clients đang connect
#   ...
# }
```

### Verify Socket Events (Browser Console)
```javascript
// Xem tất cả events socket nhận được
socket.onAny((event, ...args) => {
  console.log('Socket event:', event, args);
});
```

### Check Logs
```bash
# Socket service logs - xem connections
cd backend/services/socket-service
npm start

# Logs sẽ hiển thị:
# ✅ Socket connected: <socket-id>
# 🏪 Socket <id> joined restaurant:<storeId>
# 📦 Socket <id> joined order:<orderId>

# Order service logs - xem publish events
cd backend/services/order-service  
npm start | grep "order.confirmed"

# Restaurant service logs - xem status changes
cd backend/services/restaurant-service
npm start | grep "PREPARING"
```

### Test Socket Connection Manually
```bash
# Install socket.io-client globally
npm install -g socket.io-client

# Test connect
npx socket.io-client http://localhost:3011
```

## 🌐 Deploy Configuration

### Vercel (Frontend)
```env
# Vercel Environment Variables
VITE_SOCKET_URL=https://your-socket-service.railway.app
```

### Railway (Socket Service)
```env
# Railway Environment Variables
PORT=3011
KAFKA_BROKERS=your-kafka-broker:9092
KAFKA_SECURITY_PROTOCOL=SASL_SSL
KAFKA_USERNAME=your-api-key
KAFKA_PASSWORD=your-api-secret
```

### Docker Compose
Socket service đã được thêm vào `docker-compose.yml`:
```bash
docker-compose up -d socket-service
```

## ⚡ Performance Tips

1. **autoConnect: false** - Chỉ connect khi cần
2. **Disconnect khi unmount** - Cleanup trong useEffect
3. **Debounce events** - Tránh update UI quá nhiều lần

## 🐛 Troubleshooting

### ❌ Socket connect/disconnect liên tục (FIXED)
**Triệu chứng:** Logs hiển thị "Socket connected" → "Socket disconnected" lặp lại
**Nguyên nhân:** useEffect dependencies không ổn định, tạo socket instance mới mỗi lần render
**Giải pháp:** ✅ Đã fix - sử dụng `useRef` và empty dependency array `[]`

### Socket không connect
- Check VITE_SOCKET_URL có đúng không
- Check socket-service có chạy không (curl http://localhost:3011/health)
- Check CORS settings trong socket-service
- Clear browser cache và reload

### Không nhận được events
- Check Kafka topics đã tạo chưa: `order.confirmed`, `restaurant.order.status`
- Check order-service có publish events không (xem logs)
- Check restaurant-service có subscribe không (xem logs)
- Check socket-service có emit events không (xem logs)

### Restaurant không nhận đơn mới
- Verify storeId có đúng không (check localStorage)
- Check console logs: "Joined restaurant room"
- Test bằng cách tạo order mới từ customer

### Customer không thấy status update
- Verify orderId có đúng không
- Check console logs: "Joined order room"  
- Check restaurant-service có publish status change không

### Order status không update
- Check mapping status function: `mapRestaurantStatusToOrderStatus`
- Check filter trong `loadOngoingOrders` có include status mới không
- Check console logs để debug flow

## 📚 Files đã tạo/sửa

✅ Created:
- `frontend/cnpm-fooddelivery/src/config/socket.ts`
- `frontend/cnpm-fooddelivery/src/lib/useSocket.ts`
- `frontend/cnpm-fooddelivery/src/lib/useOrderTracking.ts`
- `frontend/restaurant-merchant/src/config/socket.ts`
- `frontend/restaurant-merchant/src/lib/useSocket.ts`
- `frontend/restaurant-merchant/src/lib/useRestaurantOrders.ts`

✅ Modified:
- `frontend/cnpm-fooddelivery/package.json` - Added socket.io-client
- `frontend/restaurant-merchant/package.json` - Added socket.io-client
- `frontend/cnpm-fooddelivery/.env` - Added VITE_SOCKET_URL
- `frontend/restaurant-merchant/.env` - Added VITE_SOCKET_URL
- `frontend/cnpm-fooddelivery/src/components/OngoingOrders.tsx` - Integrated tracking
- `frontend/restaurant-merchant/src/pages/MerchantOrdersPage.tsx` - Integrated real-time orders

## ✅ Checklist

- [x] Socket service created
- [x] Docker compose updated
- [x] Prometheus monitoring added
- [x] Frontend hooks created
- [x] Customer tracking integrated
- [x] Restaurant orders integrated
- [x] Environment variables configured
- [ ] Run `npm install` in frontends
- [ ] Test local flow
- [ ] Deploy and test production

Xong! Bây giờ chỉ cần chạy `npm install` trong các frontend và test thôi! 🎉

