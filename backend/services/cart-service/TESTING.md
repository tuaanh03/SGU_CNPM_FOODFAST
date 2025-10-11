# Cart Service - Hướng dẫn Test với Postman

## Bước 1: Login để lấy JWT Token

**Endpoint:** `POST http://localhost:3000/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response sẽ trả về:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id-here",
    "email": "user@example.com"
  }
}
```

**📋 Copy token từ response này!**

---

## Bước 2: Thêm sản phẩm vào Cart

**Endpoint:** `POST http://localhost:3000/api/cart/add`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
⚠️ **LƯU Ý**: Phải có từ khóa "Bearer " trước token!

**Body (JSON):**
```json
{
  "restaurantId": "064c84c4-2ca4-4332-b4ac-ed20e65b5324",
  "productId": "51a0476a-779c-4eba-bcbd-b0ebd365419a",
  "quantity": 2,
  "productName": "Phở Bò Tái",
  "productPrice": 25000,
  "productImage": "https://example.com/pho.jpg"
}
```

---

## Trong Postman:

### Tab Headers:
| Key | Value |
|-----|-------|
| Content-Type | application/json |
| Authorization | Bearer YOUR_TOKEN_HERE |

### Tab Body (raw, JSON):
```json
{
  "restaurantId": "064c84c4-2ca4-4332-b4ac-ed20e65b5324",
  "productId": "51a0476a-779c-4eba-bcbd-b0ebd365419a",
  "quantity": 2,
  "productName": "Phở Bò Tái",
  "productPrice": 25000,
  "productImage": "https://example.com/pho.jpg"
}
```

---

## Cách thêm Authorization trong Postman:

**Cách 1 - Dùng Authorization Tab:**
1. Chọn tab "Authorization"
2. Type: "Bearer Token"
3. Paste token vào ô "Token"

**Cách 2 - Dùng Headers Tab:**
1. Chọn tab "Headers"
2. Key: `Authorization`
3. Value: `Bearer YOUR_TOKEN_HERE`

---

## Nếu chưa có user để login:

**Tạo user mới:**
```
POST http://localhost:3000/api/auth/register

Body:
{
  "email": "testuser@example.com",
  "password": "password123",
  "name": "Test User",
  "phone": "0123456789"
}
```

Sau đó login với email/password vừa tạo.

