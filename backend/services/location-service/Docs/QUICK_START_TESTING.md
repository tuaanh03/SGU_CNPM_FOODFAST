# 🚀 QUICK START: KIỂM TRA TÍNH NĂNG MỚI

## ✅ ĐÃ THỰC HIỆN

1. **Backend:**
   - ✅ API `GET /stores/nearby` với PostGIS (max 10km)

2. **Frontend:**
   - ✅ AddressContext - Quản lý địa chỉ global
   - ✅ Header - Hiển thị & chọn địa chỉ
   - ✅ HomePage - Load nhà hàng gần tự động
   - ✅ CheckoutPage - Đơn giản hóa, chỉ review đơn

---

## 🧪 CÁCH KIỂM TRA

### **Bước 1: Chuẩn bị dữ liệu**

```sql
-- 1. Ensure stores có tọa độ
SELECT id, name, latitude, longitude 
FROM stores 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 2. Ensure user có địa chỉ với tọa độ
SELECT id, name, address, ward, district, latitude, longitude
FROM addresses
WHERE "userId" = 'your-user-id';

-- 3. Nếu chưa có, update thủ công (ví dụ TP.HCM):
UPDATE stores SET 
  latitude = 10.7750, 
  longitude = 106.7008
WHERE id = 'store-id-1';

UPDATE stores SET 
  latitude = 10.7629, 
  longitude = 106.6602
WHERE id = 'store-id-2';
```

### **Bước 2: Test API**

```bash
# Test nearby stores API
curl "http://localhost:3000/api/stores/nearby?lat=10.7629&lng=106.6602&radius=10"

# Expected:
# {
#   "success": true,
#   "data": [
#     {
#       "id": "...",
#       "name": "Nhà hàng A",
#       "distance": 1.2,
#       ...
#     }
#   ],
#   "meta": {
#     "radius": 10,
#     "total": 5,
#     "userLocation": { "lat": 10.7629, "lng": 106.6602 }
#   }
# }
```

### **Bước 3: Test Frontend**

1. **Mở trang:**
   ```
   http://localhost:5173
   ```

2. **Đăng nhập** (nếu chưa có account):
   - Email: test@example.com
   - Pass: password123

3. **Kiểm tra Header:**
   - Thấy: `📍 [Tên phường], [Tên quận] ▼`
   - Click vào → Dialog mở với danh sách địa chỉ

4. **Chọn địa chỉ:**
   - Click vào 1 địa chỉ
   - Dialog đóng
   - Header cập nhật
   - HomePage tự động reload restaurants

5. **Kiểm tra danh sách nhà hàng:**
   - Thấy: "Nhà hàng đối tác (X nhà hàng)"
   - Mỗi card có: "Cách bạn X.X km"
   - Sắp xếp theo khoảng cách tăng dần

6. **Thêm món vào giỏ:**
   - Click vào 1 nhà hàng
   - Thêm món
   - Click "Giỏ hàng"

7. **Checkout:**
   - Click "Thanh toán"
   - Kiểm tra: Địa chỉ hiển thị read-only
   - Kiểm tra: Restaurant info đúng
   - Nhập ghi chú (optional)
   - Click "Đặt hàng"

---

## ⚠️ TROUBLESHOOTING

### **Lỗi: "Không có nhà hàng nào trong 10km"**

**Nguyên nhân:**
- Stores chưa có latitude/longitude
- Hoặc địa chỉ user chưa có tọa độ
- Hoặc stores thực sự xa > 10km

**Giải pháp:**
```sql
-- Update stores với tọa độ TP.HCM
UPDATE stores SET 
  latitude = 10.7750 + (RANDOM() * 0.1 - 0.05), 
  longitude = 106.7008 + (RANDOM() * 0.1 - 0.05)
WHERE latitude IS NULL;
```

### **Lỗi: "Vui lòng chọn địa chỉ giao hàng"**

**Nguyên nhân:**
- User chưa có địa chỉ nào
- Hoặc chưa chọn địa chỉ

**Giải pháp:**
1. Đăng nhập
2. Vào Profile → Thêm địa chỉ
3. Hoặc tạo địa chỉ qua API:
```bash
curl -X POST http://localhost:3000/api/addresses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nhà",
    "phone": "0901234567",
    "address": "123 Nguyễn Huệ",
    "ward": "Bến Nghé",
    "district": "Quận 1",
    "province": "TP.HCM",
    "latitude": 10.7629,
    "longitude": 106.6602,
    "isDefault": true
  }'
```

### **Lỗi: PostGIS not found**

**Giải pháp:**
```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify
SELECT PostGIS_version();
```

---

## 📊 KẾT QUẢ MONG ĐỢI

### **HomePage:**
```
┌─────────────────────────────────────┐
│ Header: 📍 Bến Nghé, Quận 1 ▼      │
├─────────────────────────────────────┤
│ Banner                              │
├─────────────────────────────────────┤
│ Products...                         │
├─────────────────────────────────────┤
│ Nhà hàng đối tác (5 nhà hàng)      │
│                                     │
│ ┌─────────────────┐                │
│ │ [IMG] Nhà hàng A │ Gần nhất      │
│ │ ⭐ 4.5           │                │
│ │ 📍 Cách bạn 1.2 km               │
│ └─────────────────┘                │
│                                     │
│ ┌─────────────────┐                │
│ │ [IMG] Nhà hàng B │                │
│ │ ⭐ 4.3           │                │
│ │ 📍 Cách bạn 2.5 km               │
│ └─────────────────┘                │
└─────────────────────────────────────┘
```

### **CheckoutPage:**
```
┌─────────────────────────────────────┐
│ ← Quay lại   THANH TOÁN            │
├─────────────────────────────────────┤
│ THÔNG TIN NHÀ HÀNG                 │
│ [IMG] Nhà hàng A                   │
│ 2 món • 150.000đ                   │
├─────────────────────────────────────┤
│ THÔNG TIN GIAO HÀNG                │
│ ┌───────────────────────────────┐ │
│ │ Nguyễn Văn A                  │ │
│ │ 📞 0901234567                 │ │
│ │ 📍 123 Nguyễn Huệ,            │ │
│ │    Bến Nghé, Quận 1, TP.HCM   │ │
│ └───────────────────────────────┘ │
│                                     │
│ GHI CHÚ                            │
│ ┌───────────────────────────────┐ │
│ │ Không hành, gọi trước 5'...   │ │
│ └───────────────────────────────┘ │
├─────────────────────────────────────┤
│ ĐƠN HÀNG CỦA BẠN                   │
│ - Cơm tấm sườn x1    50.000đ      │
│ - Trà đá x2           10.000đ      │
│ ─────────────────────────────────  │
│ TỔNG CỘNG            150.000đ      │
│                                     │
│ [     ĐẶT HÀNG     ]               │
└─────────────────────────────────────┘
```

---

## ✅ CHECKLIST HOÀN THÀNH

- [x] Backend API nearby stores (10km)
- [x] AddressContext created
- [x] AddressSelectorDialog created
- [x] Navigation updated with address selector
- [x] HomePage load nearby restaurants
- [x] CheckoutPage simplified
- [x] App.tsx wrapped with AddressProvider
- [x] No TypeScript errors
- [x] Documentation complete

**Status: READY TO TEST** ✨

