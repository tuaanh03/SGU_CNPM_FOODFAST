# Tích hợp Frontend - Backend: Cart đến Payment

## 📋 Tổng Quan

Frontend đã được kết nối với backend qua **API Gateway** theo quy trình:
1. **Add to Cart** → API Gateway → Cart Service (Redis)
2. **View Cart** → Hiển thị giỏ hàng với đồng bộ backend
3. **Checkout** → Trang kiểm tra thông tin đơn hàng
4. **Place Order** → API Gateway → Order Service → Payment Service (qua Kafka)
5. **Payment** → Backend tự động xử lý và redirect đến VNPay

## 🔄 Luồng Hoạt Động Chi Tiết

### 1. User Thêm Món Vào Giỏ Hàng

**Frontend:**
```typescript
// File: src/components/MenuSection.tsx hoặc ProductList.tsx
const { addItem } = useCart();

// Khi user bấm "Thêm"
addItem(cartItem, restaurant);
```

**Cart Context gọi Backend:**
```typescript
// File: src/contexts/cart-context.tsx
await cartService.addToCart({
  restaurantId: restaurant.id,
  productId: item.id,
  quantity: 1,
  productName: item.name,
  productPrice: item.price,
  productImage: item.imageUrl,
});
```

**API Call:**
```
POST http://localhost:3000/api/cart/add
Headers:
  - Authorization: Bearer {token}
  - Content-Type: application/json

Body:
{
  "restaurantId": "store-uuid",
  "productId": "product-uuid",
  "quantity": 1,
  "productName": "Phở Bò",
  "productPrice": 50000,
  "productImage": "https://..."
}
```

**Backend Flow:**
```
API Gateway (port 3000) 
  → Cart Service (port 3006)
    → Redis: Lưu vào key "cart:{userId}:{restaurantId}"
```

---

### 2. User Xem Giỏ Hàng

**Frontend:**
- Bấm icon giỏ hàng → Hiển thị `CartDrawer`
- Dữ liệu từ `cart-context` đã được đồng bộ với backend

**Các thao tác:**
- **Tăng/Giảm số lượng:** Gọi `updateQuantity()` → API `/cart/{restaurantId}/{productId}` (PUT)
- **Xóa món:** Gọi `removeItem()` → API `/cart/{restaurantId}/{productId}` (DELETE)

---

### 3. User Bấm Checkout

**Frontend:**
```typescript
// File: src/components/CartDrawer.tsx
const handleCheckout = () => {
  onClose();
  navigate('/checkout');
};
```

**Checkout Page (`/checkout`):**
- Hiển thị thông tin nhà hàng
- Form nhập địa chỉ, số điện thoại, ghi chú
- Tóm tắt đơn hàng
- Nút "Đặt hàng"

---

### 4. User Bấm "Đặt Hàng"

**Frontend:**
```typescript
// File: src/pages/CheckoutPage.tsx
const handlePlaceOrder = async () => {
  const response = await orderService.createOrderFromCart({
    storeId: state.restaurant.id,
    deliveryAddress: formData.deliveryAddress,
    contactPhone: formData.contactPhone,
    note: formData.note || undefined,
  });
  
  if (response.success) {
    navigate("/my-orders");
  }
};
```

**API Call:**
```
POST http://localhost:3000/api/order/create-from-cart
Headers:
  - Authorization: Bearer {token}
  - Content-Type: application/json

Body:
{
  "storeId": "store-uuid",
  "deliveryAddress": "123 Phố Huế, Hà Nội",
  "contactPhone": "0901234567",
  "note": "Không hành"
}
```

**Backend Flow:**
```
API Gateway (port 3000)
  → Order Service (port 3002)
    1. Lấy cart từ Redis (qua Cart Service API)
    2. Validate món ăn qua MenuItemRead (Read Model)
    3. Tạo Order trong PostgreSQL
    4. Publish event "order.create" lên Kafka
    5. Xóa cart khỏi Redis
    6. Trả response về frontend
```

---

### 5. Backend Tự Động Xử Lý Payment

**Kafka Consumer (Payment Service):**
```typescript
// File: backend/services/payment-service/src/utils/kafka.ts
kafkaConsumer.on('order.create', async (message) => {
  const { orderId, userId, totalPrice, items } = message;
  
  // Tạo VNPay payment URL
  const paymentUrl = await processPayment({
    orderId,
    amount: totalPrice,
    orderDescription: `Order ${orderId} - ${items.length} items`
  });
  
  // Lưu payment intent vào database
  // Có thể gửi notification cho user (qua email/SMS)
});
```

**Flow:**
```
Order Service
  → Kafka topic "order.create"
    → Payment Service Consumer
      → Tạo VNPay URL
      → Lưu vào database
      → (Optional) Gửi notification cho user
```

---

## 🛠️ Files Đã Tạo/Sửa

### Files Mới Tạo:

1. **`src/services/cart.service.ts`**
   - Service gọi Cart API qua API Gateway
   - Các method: `addToCart`, `getCart`, `updateQuantity`, `removeFromCart`, `clearCart`

2. **`src/services/order.service.ts`**
   - Service gọi Order API qua API Gateway
   - Các method: `createOrderFromCart`, `getMyOrders`, `getOrderDetail`

3. **`src/pages/CheckoutPage.tsx`**
   - Trang checkout với form nhập thông tin giao hàng
   - Hiển thị tóm tắt đơn hàng
   - Nút "Đặt hàng" gọi API

### Files Đã Sửa:

1. **`src/contexts/cart-context.tsx`**
   - Cập nhật `addItem()` → Gọi backend API
   - Cập nhật `removeItem()` → Gọi backend API
   - Cập nhật `updateQuantity()` → Gọi backend API
   - Cập nhật `clearCart()` → Gọi backend API
   - Thêm kiểm tra đăng nhập trước khi thao tác

2. **`src/App.tsx`**
   - Thêm route `/checkout` → `<CheckoutPage />`

3. **`src/components/CartDrawer.tsx`**
   - Đã có sẵn nút "Thanh toán" navigate đến `/checkout`

---

## 🔐 Authentication

Tất cả API calls đều yêu cầu authentication:

```typescript
const token = localStorage.getItem("token");

headers: {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
}
```

Nếu user chưa đăng nhập, hiển thị toast error:
```typescript
if (!token) {
  toast.error('Vui lòng đăng nhập để sử dụng giỏ hàng');
  return;
}
```

---

## 📍 API Endpoints

### Cart Service (qua API Gateway)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cart/add` | Thêm món vào giỏ hàng |
| GET | `/api/cart/{restaurantId}` | Lấy giỏ hàng |
| PUT | `/api/cart/{restaurantId}/{productId}` | Cập nhật số lượng |
| DELETE | `/api/cart/{restaurantId}/{productId}` | Xóa món |
| DELETE | `/api/cart/{restaurantId}` | Xóa toàn bộ giỏ hàng |

### Order Service (qua API Gateway)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/order/create-from-cart` | Tạo order từ giỏ hàng |
| GET | `/api/order/my-orders` | Lấy danh sách orders |
| GET | `/api/order/{orderId}` | Lấy chi tiết order |

---

## ✅ Testing Flow

### 1. Test Add to Cart:
```bash
# Đăng nhập và lấy token
# Vào trang nhà hàng
# Bấm "Thêm" vào một món
# Kiểm tra console: Should see POST /api/cart/add
# Kiểm tra giỏ hàng: Món đã được thêm
```

### 2. Test Cart Operations:
```bash
# Mở giỏ hàng (CartDrawer)
# Thử tăng/giảm số lượng
# Kiểm tra console: Should see PUT /api/cart/{restaurantId}/{productId}
# Thử xóa một món
# Kiểm tra console: Should see DELETE /api/cart/{restaurantId}/{productId}
```

### 3. Test Checkout:
```bash
# Có món trong giỏ hàng
# Bấm "Thanh toán" → Navigate to /checkout
# Điền form: địa chỉ, số điện thoại, ghi chú
# Bấm "Đặt hàng"
# Kiểm tra console: Should see POST /api/order/create-from-cart
# Backend sẽ tự động xử lý payment qua Kafka
```

---

## 🚀 Next Steps (Optional)

1. **Payment URL Notification:**
   - Sau khi Payment Service tạo VNPay URL, có thể:
     - Gửi email cho user
     - Hiển thị notification trên web
     - Redirect trực tiếp đến VNPay URL

2. **Real-time Cart Sync:**
   - Sử dụng WebSocket/SSE để sync giỏ hàng real-time
   - Khi user thêm/xóa món trên device khác

3. **Order Status Tracking:**
   - Trang My Orders hiển thị trạng thái đơn hàng
   - Real-time update qua WebSocket

---

## 🐛 Troubleshooting

### 1. "Vui lòng đăng nhập để sử dụng giỏ hàng"
- Kiểm tra localStorage có token không: `localStorage.getItem('token')`
- Kiểm tra token còn hạn không
- Đăng nhập lại

### 2. CORS Error
- Kiểm tra API Gateway CORS config
- Đảm bảo frontend chạy trên `http://localhost:5173`
- Đảm bảo API Gateway chạy trên `http://localhost:3000`

### 3. "Lỗi khi thêm vào giỏ hàng"
- Kiểm tra Cart Service đang chạy
- Kiểm tra Redis đang chạy
- Xem logs từ backend console

### 4. "Lỗi khi tạo đơn hàng"
- Kiểm tra Order Service đang chạy
- Kiểm tra Kafka đang chạy
- Xem logs từ backend console

---

## 📝 Notes

- **Local State vs Backend State:** Cart context vẫn giữ local state để UX mượt mà, nhưng mọi thao tác đều đồng bộ với backend
- **Error Handling:** Tất cả API calls đều có try-catch và hiển thị toast notification
- **Loading States:** Các button có loading state khi đang gọi API
- **Validation:** Form checkout có validation trước khi submit
- **Backend Auto-processing:** Sau khi tạo order, backend tự động xử lý payment qua Kafka, frontend không cần gọi thêm API

---

## 🎯 Summary

Frontend đã được tích hợp hoàn toàn với backend:
- ✅ Add to cart → Backend API
- ✅ Update cart → Backend API  
- ✅ Remove from cart → Backend API
- ✅ Checkout page → Form validation
- ✅ Place order → Backend API
- ✅ Backend auto-processing → Kafka → Payment Service

Tất cả đều đi qua **API Gateway (port 3000)**, không có service nào được gọi trực tiếp từ frontend!

