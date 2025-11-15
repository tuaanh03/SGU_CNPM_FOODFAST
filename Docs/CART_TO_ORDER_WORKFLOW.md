# Workflow Cart → Order với MenuItemRead Validation

## ✅ Tổng Quan

Workflow này cho phép user tạo đơn hàng từ giỏ hàng, với validation qua **MenuItemRead (Read Model)** thay vì gọi trực tiếp Product Service.

### Kiến Trúc
```
User → Cart Service (Redis)
  ↓
Order Service:
  1. Lấy cart từ Redis (Cart Service API)
  2. Query MenuItemRead (Read Model - đã sync từ Product Service)
  3. Validate món ăn:
     ✓ Món có trong menu không?
     ✓ isAvailable = true?
     ✓ soldOutUntil đã qua chưa?
     ✓ Giá hiện tại là bao nhiêu?
  4. [Optional] Notify nếu giá thay đổi
  5. Tạo Order với snapshot giá từ MenuItemRead
  6. Clear cart sau khi tạo order thành công
```

---

## 🎯 Lợi Ích Của Workflow Này

✅ **No Direct Dependency**: Order Service không gọi trực tiếp Product Service  
✅ **Fast Validation**: Query local database (MenuItemRead) thay vì gọi API  
✅ **Eventual Consistency**: MenuItemRead được sync tự động qua Kafka  
✅ **Price Protection**: Snapshot giá tại thời điểm đặt hàng  
✅ **Availability Check**: Validate món có sẵn không, có hết hàng không  
✅ **Clean Cart**: Tự động xóa giỏ hàng sau khi đặt thành công

---

## 📋 Flow Chi Tiết

### **Bước 1: User thêm món vào giỏ hàng**
```
POST http://localhost:3006/cart/add
Authorization: Bearer {token}

{
  "restaurantId": "store-uuid",
  "productId": "product-uuid",
  "quantity": 2,
  "productName": "Phở Bò",
  "productPrice": 50000,
  "productImage": "https://example.com/pho.jpg"
}
```

**Cart Service lưu vào Redis:**
- Key: `cart:{userId}:{restaurantId}`
- Field: `productId`
- Value: `quantity`

**Lưu ý**: Giá ở đây CHỈ để hiển thị UI, KHÔNG dùng để tính tổng tiền khi checkout!

---

### **Bước 2: User checkout (Tạo order từ cart)**
```
POST http://localhost:3002/orders/create-from-cart
Authorization: Bearer {token}

{
  "storeId": "store-uuid",
  "deliveryAddress": "123 Phố Huế, Hà Nội",
  "contactPhone": "0123456789",
  "note": "Giao trước 12h"
}
```

---

### **Bước 3: Order Service xử lý**

#### 3.1. Lấy cart từ Redis
```typescript
const cartItems = await fetchUserCart(userId, storeId);
// cartItems = [
//   { productId: "product-1", quantity: 2, storeId: "store-uuid" },
//   { productId: "product-2", quantity: 1, storeId: "store-uuid" }
// ]
```

#### 3.2. Query MenuItemRead để validate
```sql
SELECT * FROM "MenuItemRead"
WHERE "storeId" = 'store-uuid'
  AND "productId" IN ('product-1', 'product-2');
```

#### 3.3. Validate từng món
```typescript
for (const cartItem of cartItems) {
  const menuItem = menuItemMap.get(cartItem.productId);
  
  // ❌ Món không có trong menu
  if (!menuItem) {
    errors.push("Món không có trong thực đơn");
  }
  
  // ❌ Món không còn bán
  if (!menuItem.isAvailable) {
    errors.push("Món hiện không còn bán");
  }
  
  // ❌ Món tạm hết hàng
  if (menuItem.soldOutUntil && now < menuItem.soldOutUntil) {
    errors.push("Món tạm hết hàng đến " + date);
  }
  
  // ✅ Lấy giá hiện tại từ MenuItemRead
  const currentPrice = parseFloat(menuItem.price);
  const subtotal = currentPrice * cartItem.quantity;
  
  validItems.push({
    productId: cartItem.productId,
    productName: menuItem.name,
    productPrice: currentPrice, // Giá HIỆN TẠI từ Read Model
    quantity: cartItem.quantity,
    subtotal: subtotal
  });
}
```

#### 3.4. Tạo Order với snapshot giá
```typescript
const order = await prisma.order.create({
  data: {
    userId,
    totalPrice: validationResult.totalPrice, // Tổng tiền từ MenuItemRead
    deliveryAddress,
    contactPhone,
    note,
    status: "pending",
    items: {
      create: validItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productPrice: item.productPrice, // Snapshot giá tại thời điểm đặt
        quantity: item.quantity
      }))
    }
  }
});
```

#### 3.5. Publish event để reserve inventory
```typescript
await publishEvent(JSON.stringify({
  orderId: order.id,
  userId: order.userId,
  items: cartItems,
  totalPrice: order.totalPrice
}));
```

#### 3.6. Clear cart
```typescript
await clearUserCart(userId, storeId);
```

---

## 🚀 API Endpoints

### 1. Thêm món vào giỏ hàng
**Cart Service - POST /cart/add**

```http
POST http://localhost:3006/cart/add
Authorization: Bearer {token}
Content-Type: application/json

{
  "restaurantId": "store-uuid",
  "productId": "product-uuid",
  "quantity": 2,
  "productName": "Phở Bò Tái",
  "productPrice": 50000,
  "productImage": "https://example.com/pho.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product added to cart",
  "data": {
    "productId": "product-uuid",
    "quantity": 2,
    "restaurantId": "store-uuid"
  }
}
```

---

### 2. Xem giỏ hàng
**Cart Service - GET /cart/:restaurantId**

```http
GET http://localhost:3006/cart/store-uuid
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "restaurantId": "store-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 2,
        "name": "Phở Bò Tái",
        "price": "50000",
        "image": "https://example.com/pho.jpg"
      }
    ],
    "totalItems": 1,
    "createdAt": "2025-01-12T10:00:00.000Z",
    "updatedAt": "2025-01-12T10:05:00.000Z"
  }
}
```

---

### 3. Tạo Order từ Cart (Workflow Mới) ⭐
**Order Service - POST /orders/create-from-cart**

```http
POST http://localhost:3002/orders/create-from-cart
Authorization: Bearer {token}
Content-Type: application/json

{
  "storeId": "store-uuid",
  "deliveryAddress": "123 Phố Huế, Hai Bà Trưng, Hà Nội",
  "contactPhone": "0123456789",
  "note": "Giao trước 12h, không hành"
}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Đơn hàng đã được tạo thành công từ giỏ hàng",
  "data": {
    "orderId": "order-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "productName": "Phở Bò Tái",
        "productPrice": 50000,
        "quantity": 2,
        "subtotal": 100000
      }
    ],
    "totalPrice": 100000,
    "status": "pending",
    "deliveryAddress": "123 Phố Huế, Hai Bà Trưng, Hà Nội",
    "contactPhone": "0123456789",
    "note": "Giao trước 12h, không hành",
    "createdAt": "2025-01-12T10:10:00.000Z"
  }
}
```

**Response Error - Giỏ hàng trống:**
```json
{
  "success": false,
  "message": "Giỏ hàng trống"
}
```

**Response Error - Món không hợp lệ:**
```json
{
  "success": false,
  "message": "Giỏ hàng có lỗi",
  "errors": [
    "Món \"Phở Bò\" hiện không còn bán",
    "Món \"Bún Chả\" tạm hết hàng đến 15/01/2025"
  ]
}
```

---

## 🧪 Hướng Dẫn Test Với Postman

### **Test Case 1: Flow Thành Công**

#### Bước 1: Đăng nhập để lấy token
```http
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "password123"
}
```

#### Bước 2: Thêm món vào giỏ hàng
```http
POST http://localhost:3006/cart/add
Authorization: Bearer {token}

{
  "restaurantId": "store-uuid",
  "productId": "product-1",
  "quantity": 2,
  "productName": "Phở Bò",
  "productPrice": 50000
}
```

#### Bước 3: Thêm món thứ 2
```http
POST http://localhost:3006/cart/add
Authorization: Bearer {token}

{
  "restaurantId": "store-uuid",
  "productId": "product-2",
  "quantity": 1,
  "productName": "Bún Chả",
  "productPrice": 45000
}
```

#### Bước 4: Xem giỏ hàng
```http
GET http://localhost:3006/cart/store-uuid
Authorization: Bearer {token}
```

#### Bước 5: Checkout - Tạo order từ cart
```http
POST http://localhost:3002/orders/create-from-cart
Authorization: Bearer {token}

{
  "storeId": "store-uuid",
  "deliveryAddress": "123 Phố Huế",
  "contactPhone": "0123456789"
}
```

#### Bước 6: Kiểm tra cart đã được clear chưa
```http
GET http://localhost:3006/cart/store-uuid
Authorization: Bearer {token}
```
**Expected:** Cart trống hoặc không tồn tại

---

### **Test Case 2: Món Không Còn Bán**

#### Bước 1: Thêm món vào cart
```http
POST http://localhost:3006/cart/add
Authorization: Bearer {token}

{
  "restaurantId": "store-uuid",
  "productId": "product-unavailable",
  "quantity": 1
}
```

#### Bước 2: Admin đánh dấu món hết hàng (Product Service)
```http
PUT http://localhost:3003/products/product-unavailable/availability
Authorization: Bearer {admin_token}

{
  "isAvailable": false,
  "unavailableReason": "Hết nguyên liệu"
}
```

**→ Kafka event UPDATED được publish → Order Service cập nhật MenuItemRead**

#### Bước 3: User checkout
```http
POST http://localhost:3002/orders/create-from-cart
Authorization: Bearer {token}

{
  "storeId": "store-uuid",
  "deliveryAddress": "123 Phố Huế",
  "contactPhone": "0123456789"
}
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Giỏ hàng có lỗi",
  "errors": [
    "Món \"...\" hiện không còn bán"
  ]
}
```

---

### **Test Case 3: Giá Thay Đổi (Optional)**

#### Bước 1: Thêm món vào cart (giá cũ: 50000)
```http
POST http://localhost:3006/cart/add
{
  "productId": "product-1",
  "quantity": 1,
  "productPrice": 50000
}
```

#### Bước 2: Admin thay đổi giá (giá mới: 55000)
```http
PUT http://localhost:3003/products/product-1
{
  "price": 55000
}
```

**→ Kafka event UPDATED → MenuItemRead cập nhật giá mới**

#### Bước 3: User checkout
```http
POST http://localhost:3002/orders/create-from-cart
```

**Hiện tại**: Order được tạo với giá mới (55000)

**Nếu bạn muốn notify user về giá thay đổi**, uncomment đoạn code trong controller:
```typescript
// Bước 3: Kiểm tra giá có thay đổi không
const priceCheck = await checkPriceChanges(cartItems);
if (priceCheck.hasChanges) {
    return res.status(200).json({
        success: false,
        requireConfirmation: true,
        message: "Giá một số món đã thay đổi. Vui lòng xác nhận lại.",
        priceChanges: priceCheck.changes,
        newTotal: validationResult.totalPrice
    });
}
```

---

## 📊 Database Queries Để Kiểm Tra

### Kiểm tra MenuItemRead có data chưa
```sql
SELECT * FROM "MenuItemRead" 
WHERE "storeId" = 'your-store-id'
ORDER BY "lastSyncedAt" DESC;
```

### Kiểm tra Order đã tạo
```sql
SELECT 
  o.id, 
  o."userId", 
  o."totalPrice", 
  o.status,
  o."createdAt"
FROM "Order" o
WHERE o."userId" = 'your-user-id'
ORDER BY o."createdAt" DESC
LIMIT 5;
```

### Kiểm tra OrderItems với giá snapshot
```sql
SELECT 
  oi.id,
  oi."orderId",
  oi."productId",
  oi."productName",
  oi."productPrice",
  oi.quantity,
  (oi."productPrice" * oi.quantity) as subtotal
FROM "OrderItem" oi
WHERE oi."orderId" = 'your-order-id';
```

### So sánh giá trong Order vs giá hiện tại
```sql
SELECT 
  oi."productName",
  oi."productPrice" as "order_price",
  mi.price as "current_price",
  (mi.price - oi."productPrice") as "price_diff"
FROM "OrderItem" oi
LEFT JOIN "MenuItemRead" mi ON oi."productId" = mi."productId"
WHERE oi."orderId" = 'your-order-id';
```

---

## 🔄 Workflow Hoàn Chỉnh

```
1. Product Service tạo/cập nhật product
   ↓
2. Kafka event published (product.sync)
   ↓
3. Order Service consume event → cập nhật MenuItemRead
   ↓
4. User thêm món vào Cart (Cart Service - Redis)
   ↓
5. User checkout → Order Service:
   - Lấy cart từ Redis
   - Query MenuItemRead
   - Validate món ăn
   - Tạo Order với snapshot giá
   - Clear cart
   ↓
6. Order Service publish event (order.create)
   ↓
7. Product Service reserve inventory
   ↓
8. Payment Service xử lý thanh toán
```

---

## 🎯 Ưu Điểm So Với Workflow Cũ

| Workflow Cũ | Workflow Mới |
|-------------|--------------|
| Order Service gọi API Product Service | Order Service query local MenuItemRead |
| Slow (network call) | Fast (local database) |
| Tight coupling | Loose coupling |
| Single point of failure | Resilient (eventual consistency) |
| Không có price snapshot | Có snapshot giá tại thời điểm đặt |
| Không validate availability | Validate qua MenuItemRead |

---

## 🐛 Troubleshooting

### Cart trống khi checkout
- Kiểm tra TTL của cart trong Redis (mặc định 7 ngày)
- Kiểm tra user đang thao tác đúng storeId chưa

### Món không có trong thực đơn
- Kiểm tra Product Service đã publish event chưa
- Kiểm tra Order Service đã consume event chưa
- Query bảng MenuItemRead xem có data chưa

### Giá không đúng
- Kiểm tra MenuItemRead.price có đúng không
- Kiểm tra lastSyncedAt để biết lần sync cuối
- Restart Order Service để consumer chạy lại

### Cart không bị clear sau khi tạo order
- Không ảnh hưởng đến order (order đã tạo thành công)
- Kiểm tra Cart Service có chạy không
- Có thể manual clear qua API

---

## 🎉 Kết Luận

Workflow đã hoàn chỉnh với:
- ✅ Cart Service lưu vào Redis
- ✅ Order Service validate qua MenuItemRead (Read Model)
- ✅ Snapshot giá tại thời điểm đặt hàng
- ✅ Validate availability và soldOut
- ✅ Auto clear cart sau khi checkout thành công
- ✅ Loose coupling - không phụ thuộc trực tiếp Product Service

**Flow mới nhanh hơn, an toàn hơn và scalable hơn!** 🚀

