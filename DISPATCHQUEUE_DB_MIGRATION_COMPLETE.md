# ✅ DispatchQueuePage - ĐÃ CHUYỂN SANG DÙNG DỮ LIỆU TỪ DB

## 🔄 Những gì đã thay đổi

### **Trước đây:**
- ❌ Dùng **mockData** từ file `mockData.ts`
- ❌ Hiển thị orders giả lập với status `PENDING_APPROVAL`
- ❌ Không kết nối với drone-service backend

### **Bây giờ:**
- ✅ Dùng **dữ liệu thực từ DB** (drone-service)
- ✅ Fetch deliveries với status `PENDING` (chờ assign drone)
- ✅ Real-time updates qua Socket.IO
- ✅ Auto reload khi có delivery mới từ Kafka

---

## 📁 Files đã tạo/sửa

### 1. **NEW FILE:** `delivery.service.ts`
**Path:** `frontend/admin-dashboard/src/services/delivery.service.ts`

```typescript
class DeliveryService {
  async getAllDeliveries(filters?: { status?: string; droneId?: string })
  async getDeliveryById(id: string)
  async getDeliveryByOrderId(orderId: string)
  async updateDeliveryStatus(id: string, status: string)
  async assignDrone(deliveryId: string, droneId: string)
}
```

**Features:**
- Gọi API Gateway → Drone Service
- Authentication với token `system_admin_token`
- CRUD operations cho deliveries

---

### 2. **UPDATED:** `DispatchQueuePage.tsx`
**Path:** `frontend/admin-dashboard/src/pages/DispatchQueuePage.tsx`

**Thay đổi:**
```diff
- import { mockOrders } from "@/services/mockData";
- const [orders] = useState<Order[]>(mockOrders.filter(...));
+ import { deliveryService, type Delivery } from "@/services/delivery.service";
+ const [deliveries, setDeliveries] = useState<Delivery[]>([]);
+ const [loading, setLoading] = useState(true);

+ useEffect(() => {
+   const fetchDeliveries = async () => {
+     const response = await deliveryService.getAllDeliveries({ status: 'PENDING' });
+     if (response.success) {
+       setDeliveries(response.data);
+     }
+   };
+   fetchDeliveries();
+ }, []);
```

**Removed:**
- ❌ `formatCurrency()` helper (không dùng)
- ❌ `getStatusColor()` helper (không dùng)
- ❌ `getStatusText()` helper (không dùng)
- ❌ Mock orders data

**Added:**
- ✅ Fetch deliveries from DB on mount
- ✅ Loading state với spinner
- ✅ Auto reload khi nhận socket event `dispatch:delivery:created`
- ✅ Display real delivery data (restaurantName, customerName, distance, etc.)

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. COMPONENT MOUNT                                              │
│    useEffect() → fetchDeliveries()                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. DELIVERY SERVICE                                             │
│    GET /api/deliveries?status=PENDING                           │
│    Headers: Authorization: Bearer {system_admin_token}          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. API GATEWAY                                                  │
│    Proxy → Drone Service (port 3008)                            │
│    Authenticate token                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DRONE SERVICE                                                │
│    Query DB: SELECT * FROM deliveries WHERE status = 'PENDING'  │
│    Return: { success: true, data: [...] }                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. DISPATCHQUEUEPAGE                                            │
│    setDeliveries(response.data)                                 │
│    setLoading(false)                                             │
│    → Render deliveries list                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Real-time Updates

```
┌─────────────────────────────────────────────────────────────────┐
│ Restaurant merchant clicks "Thông báo đội giao"                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Restaurant Service → Kafka: ORDER_READY_FOR_PICKUP              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────┴─────────────────┐
            ↓                                   ↓
┌──────────────────────────┐    ┌──────────────────────────┐
│ Socket Service           │    │ Drone Service            │
│ - Emit to dispatch room  │    │ - Upsert delivery (DB)   │
└──────────────────────────┘    └──────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────────────┐
│ DispatchQueuePage (listening)                                   │
│ - handleDeliveryCreated() triggered                             │
│ - Add to deliveryNotifications state                            │
│ - Reload deliveries from DB                                     │
│ - UI updates INSTANTLY                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI Display

### **Section 1: Real-time Notifications (Green Cards)**
- Green border + green background
- Badge "READY FOR PICKUP"
- Shows: Restaurant pickup location, customer address, price, items
- Auto-added when socket receives event

### **Section 2: Pending Deliveries (Blue Cards)**
- Blue border
- Badge with status (PENDING, ASSIGNED, etc.)
- Shows: Customer info, restaurant info, address, distance, estimated time
- Drone assignment status
- Fetched from DB on load

### **Loading State:**
- Spinner animation
- Text: "Đang tải danh sách deliveries..."

### **Empty State:**
- Drone icon
- Text: "Không có đơn hàng chờ xử lý"

---

## 🧪 Testing

### **Test 1: Initial Load**
```bash
# 1. Login as SYSTEM_ADMIN
# 2. Navigate to /dispatch
# Expected: Loading spinner → Deliveries list from DB
```

### **Test 2: Real-time Notification**
```bash
# 1. Open admin dashboard /dispatch
# 2. From merchant UI: Click "Thông báo đội giao"
# Expected: Green card appears instantly at top
```

### **Test 3: Empty State**
```bash
# 1. Ensure no PENDING deliveries in DB
# 2. Navigate to /dispatch
# Expected: Empty state message
```

### **Test 4: Check DB Data**
```bash
docker exec -it drone-db psql -U postgres -d foodfast_drone

SELECT "orderId", status, "restaurantName", "customerName" 
FROM deliveries 
WHERE status = 'PENDING' 
ORDER BY "createdAt" DESC;

# Expected: Same data shown in UI
```

---

## 📊 Data Model

```typescript
interface Delivery {
  id: string;
  orderId: string;
  droneId: string;              // Empty = chưa assign
  restaurantName: string;
  restaurantLat: number;
  restaurantLng: number;
  restaurantAddress: string;
  customerName: string;
  customerPhone: string;
  customerLat: number;
  customerLng: number;
  customerAddress: string;
  distance: number;             // km
  estimatedTime: number;        // minutes
  status: 'PENDING' | 'ASSIGNED' | ...;
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔒 Security

✅ **Authentication Required:**
- Endpoint: `/api/deliveries` requires Bearer token
- Token: `system_admin_token` from localStorage
- Middleware: `authenticateToken` in API Gateway

✅ **Authorization:**
- Only SYSTEM_ADMIN role can access
- Protected by `ProtectedRoute` component

---

## 🚀 Next Steps (Optional Enhancements)

1. **Drone Assignment UI:**
   - Add button "Assign Drone" on each delivery card
   - Modal to select available drone
   - Call `deliveryService.assignDrone(deliveryId, droneId)`

2. **Status Updates:**
   - Add buttons to change status: PICKING_UP → IN_TRANSIT → DELIVERED
   - Real-time status sync with Socket

3. **Filters:**
   - Filter by status (PENDING, ASSIGNED, IN_TRANSIT)
   - Filter by date range
   - Search by orderId or customer name

4. **Pagination:**
   - Add pagination for large delivery lists
   - Lazy loading

5. **Map View:**
   - Show deliveries on map
   - Display restaurant → customer route
   - Show drone positions

---

## ✅ Summary

**Đã chuyển đổi thành công:**
- ❌ Mock data → ✅ Real database data
- ❌ Static list → ✅ Dynamic fetch with loading
- ❌ No real-time → ✅ Socket.IO real-time updates
- ❌ Fake orders → ✅ Actual deliveries from drone-service

**Sẵn sàng production!** 🎉

