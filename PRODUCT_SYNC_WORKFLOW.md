# Workflow Đồng Bộ Sản Phẩm - Product Service ↔ Order Service

## ✅ Tổng Quan

Workflow này đồng bộ sản phẩm (món ăn) từ **Product Service** sang **Order Service** thông qua Kafka topic `product.sync`.

### Kiến Trúc
```
Product Service (Source of Truth - Publisher)
    ↓ Kafka Topic: product.sync
Order Service (Consumer - Read Model)
    ↓ Lưu vào bảng MenuItemRead
```

---

## 📋 Vai Trò Từng Service

### 1. Product Service
- **Quản lý TẤT CẢ sản phẩm** (món ăn)
- Mỗi product có `storeId` → biết món thuộc cửa hàng nào
- Khi CRUD product → publish event lên Kafka topic `product.sync`

### 2. Restaurant Service
- **CHỈ quản lý thông tin cửa hàng** (Store)
- KHÔNG quản lý menu/món ăn

### 3. Order Service
- Subscribe Kafka topic `product.sync`
- Lưu vào `MenuItemRead` làm **read-model** để tạo order nhanh
- Tránh phụ thuộc trực tiếp vào Product Service khi tạo đơn hàng

---

## 🎯 Các Event Types

### 1. **CREATED** - Tạo product mới
### 2. **UPDATED** - Cập nhật product
### 3. **DELETED** - Xóa product

---

## 🚀 API Endpoints - Product Service

### Base URL: `http://localhost:3003` (Product Service)

---

### 1. Tạo Sản Phẩm (POST /products)
**Authorization:** Bearer Token (STORE_ADMIN)

**Request Body:**
```json
{
  "sku": "PHO-001",
  "name": "Phở Bò Tái",
  "price": 50000,
  "description": "Phở bò Hà Nội truyền thống với thịt bò tái",
  "imageUrl": "https://example.com/pho-bo.jpg",
  "categoryId": "category-uuid",
  "isAvailable": true,
  "storeId": "store-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "product-uuid",
    "sku": "PHO-001",
    "name": "Phở Bò Tái",
    "price": 50000,
    "description": "Phở bò Hà Nội truyền thống với thịt bò tái",
    "imageUrl": "https://example.com/pho-bo.jpg",
    "categoryId": "category-uuid",
    "isAvailable": true,
    "storeId": "store-uuid",
    "createdAt": "2025-10-12T10:00:00.000Z"
  },
  "message": "Tạo sản phẩm thành công"
}
```

**Kafka Event Published:**
```json
{
  "eventType": "CREATED",
  "timestamp": "2025-10-12T10:00:00.000Z",
  "data": {
    "id": "product-uuid",
    "storeId": "store-uuid",
    "name": "Phở Bò Tái",
    "description": "Phở bò Hà Nội truyền thống với thịt bò tái",
    "price": "50000",
    "imageUrl": "https://example.com/pho-bo.jpg",
    "categoryId": "category-uuid",
    "isAvailable": true,
    "soldOutUntil": null
  }
}
```

---

### 2. Lấy Tất Cả Sản Phẩm (GET /products)
**Query Parameters:**
- `categoryId` (optional): Lọc theo category
- `isAvailable` (optional): Lọc sản phẩm có sẵn (true/false)
- `storeId` (optional): Lọc theo cửa hàng

**Example:**
```
GET /products?storeId=store-uuid&isAvailable=true
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "product-uuid",
      "name": "Phở Bò Tái",
      "price": 50000,
      "isAvailable": true,
      "storeId": "store-uuid",
      "category": {
        "id": "category-uuid",
        "name": "Món chính"
      }
    }
  ]
}
```

---

### 3. Cập Nhật Sản Phẩm (PUT /products/:id)
**Authorization:** Bearer Token (STORE_ADMIN)

**Request Body:**
```json
{
  "name": "Phở Bò Đặc Biệt",
  "price": 60000,
  "isAvailable": false,
  "soldOutUntil": "2025-10-15T00:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "product-uuid",
    "name": "Phở Bò Đặc Biệt",
    "price": 60000,
    "isAvailable": false,
    "soldOutUntil": "2025-10-15T00:00:00.000Z"
  },
  "message": "Cập nhật sản phẩm thành công"
}
```

**Kafka Event Published:**
```json
{
  "eventType": "UPDATED",
  "timestamp": "2025-10-12T10:05:00.000Z",
  "data": {
    "id": "product-uuid",
    "storeId": "store-uuid",
    "name": "Phở Bò Đặc Biệt",
    "price": "60000",
    "isAvailable": false,
    "soldOutUntil": "2025-10-15T00:00:00.000Z"
  }
}
```

---

### 4. Xóa Sản Phẩm (DELETE /products/:id)
**Authorization:** Bearer Token (STORE_ADMIN)

**Response:**
```json
{
  "success": true,
  "message": "Xóa sản phẩm thành công"
}
```

**Kafka Event Published:**
```json
{
  "eventType": "DELETED",
  "timestamp": "2025-10-12T10:10:00.000Z",
  "data": {
    "id": "product-uuid",
    "storeId": "store-uuid"
  }
}
```

---

### 5. Cập Nhật Trạng Thái Sản Phẩm (PUT /products/:id/availability)
**Authorization:** Bearer Token (STORE_ADMIN)

**Request Body:**
```json
{
  "isAvailable": false,
  "soldOutUntil": "2025-10-15T00:00:00.000Z",
  "unavailableReason": "Hết nguyên liệu"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "product-uuid",
    "isAvailable": false,
    "soldOutUntil": "2025-10-15T00:00:00.000Z",
    "unavailableReason": "Hết nguyên liệu"
  },
  "message": "Cập nhật trạng thái sản phẩm thành công"
}
```

---

## 🔄 Order Service - Consumer Handler

### Bảng MenuItemRead (Read Model)
Order Service lắng nghe topic `product.sync` và cập nhật vào bảng `MenuItemRead`:

```prisma
model MenuItemRead {
  id      String @id @default(uuid())
  storeId String
  menuId  String  // Sử dụng storeId làm menuId
  productId String
  
  name        String
  description String?
  price       Decimal
  imageUrl    String?
  categoryId  String?
  
  isAvailable  Boolean
  soldOutUntil DateTime?
  displayOrder Int
  
  version      Int
  lastSyncedAt DateTime
  
  @@unique([menuId, productId])
}
```

### Bảng RestaurantSyncStatus
Theo dõi trạng thái đồng bộ:

```prisma
model RestaurantSyncStatus {
  storeId         String   @id
  menuId          String?
  lastSyncedAt    DateTime
  lastSyncVersion Int
  totalMenuItems  Int
  isHealthy       Boolean
}
```

---

## 🧪 Hướng Dẫn Test Với Postman

### Bước 1: Lấy Token STORE_ADMIN
Đăng nhập vào User Service để lấy JWT token với role `STORE_ADMIN`.

```http
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "email": "store@example.com",
  "password": "password123"
}
```

### Bước 2: Tạo Store (Restaurant Service)
```http
POST http://localhost:3005/stores
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Quán Phở ABC",
  "address": "123 Phố Huế",
  "ward": "Minh Khai",
  "district": "Hai Bà Trưng",
  "province": "Hà Nội",
  "phone": "0123456789",
  "email": "pho@example.com",
  "openTime": "06:00",
  "closeTime": "22:00"
}
```

**Lưu lại `storeId` từ response!**

### Bước 3: Tạo Category (Product Service)
```http
POST http://localhost:3003/categories
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Món chính"
}
```

**Lưu lại `categoryId` từ response!**

### Bước 4: Tạo Product
```http
POST http://localhost:3003/products
Authorization: Bearer {token}
Content-Type: application/json

{
  "sku": "PHO-001",
  "name": "Phở Bò Tái",
  "price": 50000,
  "description": "Phở bò Hà Nội truyền thống",
  "imageUrl": "https://example.com/pho-bo.jpg",
  "categoryId": "{categoryId}",
  "isAvailable": true,
  "storeId": "{storeId}"
}
```

### Bước 5: Kiểm Tra Logs

**Product Service logs:**
```
Published product sync event: CREATED product-uuid
```

**Order Service logs:**
```
Received event from topic product.sync: { eventType: 'CREATED', ... }
Processing product sync event: CREATED
Product xxx synchronized to MenuItemRead successfully (CREATED)
```

### Bước 6: Kiểm Tra Database Order Service

Kết nối vào PostgreSQL của Order Service:

```sql
-- Xem products đã đồng bộ
SELECT * FROM "MenuItemRead" WHERE "storeId" = 'your-store-id';

-- Kết quả mong đợi:
-- id: menu-item-{product-uuid}
-- storeId: store-uuid
-- menuId: store-uuid (dùng storeId làm menuId)
-- productId: product-uuid
-- name: Phở Bò Tái
-- price: 50000
-- isAvailable: true

-- Xem trạng thái đồng bộ
SELECT * FROM "RestaurantSyncStatus" WHERE "storeId" = 'your-store-id';

-- Kết quả mong đợi:
-- storeId: store-uuid
-- totalMenuItems: 1
-- isHealthy: true
-- lastSyncedAt: 2025-10-12T10:00:00.000Z
```

---

## 🔄 Test Workflow Hoàn Chỉnh

### Test 1: Tạo Product → Kiểm tra đồng bộ
1. Tạo product qua Product Service
2. Kiểm tra log Order Service nhận event
3. Query bảng `MenuItemRead` xem có data chưa

### Test 2: Cập nhật Product → Kiểm tra đồng bộ
1. Cập nhật product (đổi giá, tên, availability)
2. Kiểm tra log Order Service nhận event UPDATED
3. Query bảng `MenuItemRead` xem data đã update chưa

### Test 3: Xóa Product → Kiểm tra đồng bộ
1. Xóa product qua Product Service
2. Kiểm tra log Order Service nhận event DELETED
3. Query bảng `MenuItemRead` xem record đã bị xóa chưa

### Test 4: Eventual Consistency
1. Tạo nhiều products liên tục (3-5 products)
2. Kiểm tra tất cả đều được đồng bộ
3. Xem `RestaurantSyncStatus.totalMenuItems` có đúng số lượng không

---

## 🎯 Ưu Điểm Của Kiến Trúc Này

✅ **Single Source of Truth**: Product Service quản lý toàn bộ sản phẩm  
✅ **Không Duplicate Data**: Restaurant Service không cần quản lý menu  
✅ **Eventual Consistency**: Order Service có read-model để tạo order nhanh  
✅ **Loose Coupling**: Các service độc lập, không phụ thuộc trực tiếp  
✅ **Scalability**: Dễ dàng scale từng service riêng biệt  
✅ **Event-Driven**: Sử dụng Kafka để đồng bộ bất đồng bộ

---

## 🐛 Troubleshooting

### Kafka không kết nối được
- Kiểm tra Kafka đang chạy: `docker ps | grep kafka`
- Kiểm tra network trong docker-compose.yml
- Restart services: `docker-compose restart`

### Event không được consume
- Kiểm tra consumer đã subscribe topic `product.sync` chưa
- Xem logs của Order Service
- Verify topic tồn tại: 
  ```bash
  docker exec -it kafka kafka-topics --list --bootstrap-server localhost:9092
  ```

### Data không đồng bộ
- Kiểm tra logs có error không
- Xem version trong database
- Kiểm tra unique constraint `menuId_productId`
- Thử xóa data cũ và tạo lại

### Lỗi "Cannot read property of null"
- Kiểm tra `storeId` có được truyền vào khi tạo product không
- Xem event có đầy đủ fields không

---

## 📊 Monitoring

### Kiểm tra trạng thái đồng bộ
```sql
SELECT 
  rs.storeId,
  rs.totalMenuItems,
  rs.lastSyncedAt,
  rs.isHealthy,
  COUNT(mi.id) as actual_items
FROM "RestaurantSyncStatus" rs
LEFT JOIN "MenuItemRead" mi ON rs.storeId = mi.storeId
GROUP BY rs.storeId, rs.totalMenuItems, rs.lastSyncedAt, rs.isHealthy;
```

### Kiểm tra products chưa được đồng bộ
```sql
-- Query này cần join giữa 2 databases (Product và Order)
-- Hoặc có thể dùng script để so sánh
```

---

## 🎉 Kết Luận

Workflow đã hoàn chỉnh với:
- ✅ Product Service publish events khi CRUD products
- ✅ Order Service consume events và cập nhật MenuItemRead
- ✅ Không cần tạo menu trong Restaurant Service
- ✅ Sử dụng storeId làm menuId để đơn giản hóa

**Bạn đã có Product Service quản lý sản phẩm, không cần phải tạo thêm phần menu!** 🚀

