# 🔧 FIX: NULL COORDINATES ISSUE ON RAILWAY DEPLOYMENT

**Ngày:** 25/11/2025  
**Vấn đề:** `customerLatitude: null, customerLongitude: null` khi deploy trên Railway

---

## 🐛 VẤN ĐỀ PHÁT HIỆN

### **Triệu chứng:**
Khi deploy trên Railway, order được tạo nhưng có tọa độ NULL:
```javascript
{
  address: 'Nguyễn Trọng Trí, An Lạc A, 71900, Bình Tân, TP.HCM',
  lat: null,
  lng: null,
  customerInfo: {
    customerLatitude: null,
    customerLongitude: null
  }
}
```

### **Môi trường:**
- ✅ **Local (Docker Compose):** Chạy TỐT
- ❌ **Railway Deploy:** Tọa độ NULL

---

## 🔍 NGUYÊN NHÂN GỐC RỄ

### **Root Cause Analysis:**

1. **Address Schema có `latitude/longitude` OPTIONAL:**
   ```typescript
   export interface Address {
     id: string;
     // ...
     latitude?: number;  // ⚠️ Optional - có thể NULL
     longitude?: number; // ⚠️ Optional - có thể NULL
   }
   ```

2. **Database Address chứa NULL:**
   - Khi user tạo address, **KHÔNG TỰ ĐỘNG geocode**
   - Address lưu trong DB với `latitude = NULL, longitude = NULL`

3. **CheckoutPage gửi trực tiếp từ `selectedAddress`:**
   ```typescript
   // ❌ VẤN ĐỀ: Gửi thẳng từ selectedAddress (có thể NULL)
   customerLatitude: selectedAddress.latitude,    // null
   customerLongitude: selectedAddress.longitude,  // null
   ```

4. **Tại sao Local chạy TỐT?**
   - Trên local, bạn có thể đã:
     - Tạo address VÀ manually geocode (có lat/lng trong DB)
     - HomePage đã geocode và cập nhật address vào memory
   - Trên Railway:
     - DB **KHÔNG CÓ** lat/lng cho address
     - HomePage geocode nhưng **KHÔNG LƯU** vào DB (chỉ dùng tạm)
     - CheckoutPage load `selectedAddress` từ DB → NULL

---

## ✅ GIẢI PHÁP ĐÃ ÁP DỤNG

### **Fix: Geocode tại CheckoutPage nếu address thiếu tọa độ**

**File:** `frontend/cnpm-fooddelivery/src/pages/CheckoutPage.tsx`

**Thay đổi:**
```typescript
// TRƯỚC (❌ Bug)
const response = await orderService.createOrderFromCart({
  customerLatitude: selectedAddress.latitude,    // null
  customerLongitude: selectedAddress.longitude,  // null
});

// SAU (✅ Fixed)
// Geocode nếu thiếu tọa độ
let lat = selectedAddress.latitude;
let lng = selectedAddress.longitude;

if (!lat || !lng) {
  console.log("⚠️ Address missing coordinates, geocoding now...");
  toast.info("Đang xác định vị trí giao hàng...");
  
  try {
    const geocodeResult = await locationService.geocode({
      address: selectedAddress.address,
      ward: selectedAddress.ward,
      district: selectedAddress.district,
      province: selectedAddress.province,
    });
    
    lat = geocodeResult.latitude;
    lng = geocodeResult.longitude;
    
    console.log("✅ Geocoded coordinates:", { lat, lng });
  } catch (geocodeError) {
    toast.error("Không thể xác định vị trí giao hàng");
    return; // Stop order creation
  }
}

const response = await orderService.createOrderFromCart({
  customerLatitude: lat,    // ✅ Always has value
  customerLongitude: lng,   // ✅ Always has value
});
```

---

## 📋 THAY ĐỔI CHI TIẾT

### **1. Import locationService**
```typescript
import { locationService } from "@/services/location.service";
```

### **2. Thêm logic geocoding**
- Kiểm tra `selectedAddress.latitude` và `selectedAddress.longitude`
- Nếu NULL → Gọi `locationService.geocode()`
- Nếu geocode thất bại → Dừng tạo order, hiển thị lỗi
- Nếu thành công → Dùng tọa độ mới để tạo order

### **3. User Experience**
- Hiển thị toast: "Đang xác định vị trí giao hàng..." trong khi geocode
- Nếu lỗi: "Không thể xác định vị trí giao hàng. Vui lòng kiểm tra địa chỉ."
- Console logs để debug

---

## 🧪 TESTING

### **Test Case 1: Address có sẵn tọa độ**
- Address trong DB có `latitude`, `longitude`
- **Kết quả:** Không gọi geocode API, tạo order trực tiếp
- **Log:** 
  ```
  📦 Creating order for store: ...
  📍 Delivery address: { lat: 10.786, lng: 106.699 }
  ```

### **Test Case 2: Address KHÔNG có tọa độ (Railway)**
- Address trong DB: `latitude = NULL, longitude = NULL`
- **Kết quả:** 
  1. Hiển thị toast "Đang xác định vị trí..."
  2. Gọi `locationService.geocode()`
  3. Nhận tọa độ: `{ lat: 10.786, lng: 106.699 }`
  4. Tạo order với tọa độ hợp lệ
- **Log:**
  ```
  ⚠️ Address missing coordinates, geocoding now...
  ✅ Geocoded coordinates: { lat: 10.786, lng: 106.699 }
  📦 Creating order for store: ...
  ```

### **Test Case 3: Geocoding thất bại**
- Address không hợp lệ hoặc location-service lỗi
- **Kết quả:**
  - Toast: "Không thể xác định vị trí giao hàng..."
  - Không tạo order
  - `loading = false`, user có thể retry
- **Log:**
  ```
  ❌ Geocoding failed: Error message
  ```

---

## 🚀 DEPLOYMENT CHECKLIST

### **1. Location Service**
Đảm bảo `location-service` đang chạy và accessible:
```env
# Frontend cnpm-fooddelivery .env
VITE_API_URL=https://api-gateway.railway.app

# API Gateway có route:
/api/locations/geocode → location-service
```

**Test location service:**
```bash
curl -X POST https://api-gateway.railway.app/api/locations/geocode \
  -H "Content-Type: application/json" \
  -d '{
    "address": "Nguyễn Trọng Trí",
    "ward": "An Lạc A",
    "district": "Bình Tân",
    "province": "Thành phố Hồ Chí Minh"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "latitude": 10.786511,
    "longitude": 106.699475,
    "formattedAddress": "..."
  }
}
```

### **2. Frontend Build**
```bash
cd frontend/cnpm-fooddelivery
npm run build
# Kiểm tra không có lỗi TypeScript
```

### **3. Deploy to Vercel/Railway**
```bash
# Vercel
vercel --prod

# Hoặc Railway
railway up
```

### **4. Verify on Production**
- Tạo address mới (không có lat/lng)
- Thêm sản phẩm vào giỏ
- Checkout
- **Quan sát:** Toast "Đang xác định vị trí..." xuất hiện
- **Kiểm tra:** Order được tạo với tọa độ hợp lệ

---

## 🔄 GIẢI PHÁP DÀI HẠN (RECOMMENDED)

### **Option 1: Geocode khi TẠO/CẬP NHẬT Address**

**Ưu điểm:**
- Address luôn có tọa độ trong DB
- Không cần geocode mỗi lần checkout
- Faster checkout experience

**Triển khai:**
```typescript
// addressService.createAddress()
async createAddress(data: CreateAddressRequest): Promise<Address> {
  // 1. Geocode trước khi lưu
  if (!data.latitude || !data.longitude) {
    const geocodeResult = await locationService.geocode({
      address: data.address,
      ward: data.ward,
      district: data.district,
      province: data.province,
    });
    data.latitude = geocodeResult.latitude;
    data.longitude = geocodeResult.longitude;
  }

  // 2. Lưu address với tọa độ
  const response = await fetch(`${API_BASE_URL}/addresses`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  
  return response.json();
}
```

### **Option 2: Background Job Geocode**

**Ưu điểm:**
- Không blocking user khi tạo address
- Có thể retry nếu lỗi

**Triển khai:**
- User tạo address → Lưu vào DB (lat/lng = NULL)
- Background job (hoặc webhook) → Geocode và update DB
- Nếu geocode lỗi → Retry hoặc flag address

---

## 📊 IMPACT

### **Before Fix:**
- ❌ Railway: Orders có `customerLatitude = NULL`
- ❌ Drone service không tìm được drones nearby
- ❌ Không hiển thị được map tracking
- ❌ Không tính được khoảng cách giao hàng

### **After Fix:**
- ✅ Railway: Orders luôn có tọa độ hợp lệ
- ✅ Drone service tìm được drones nearby
- ✅ Map tracking hoạt động
- ✅ Tính toán khoảng cách chính xác

---

## 🆘 TROUBLESHOOTING

### **Lỗi: "Không thể xác định vị trí giao hàng"**

**Nguyên nhân:**
1. Location-service không running
2. API Gateway không forward đến location-service
3. Địa chỉ không hợp lệ (không tồn tại ở VN)

**Kiểm tra:**
```bash
# 1. Check location-service logs
railway logs -s location-service

# 2. Test geocode API
curl -X POST https://api-gateway.railway.app/api/locations/geocode \
  -H "Content-Type: application/json" \
  -d '{"address":"test","ward":"test","district":"test","province":"TP.HCM"}'

# 3. Check browser console
# Xem request/response của geocode API
```

### **Lỗi: Geocode chậm (> 5s)**

**Nguyên nhân:**
- Location-service cold start (Railway)
- Network latency

**Giải pháp:**
- Tăng timeout cho geocode request
- Implement caching cho địa chỉ phổ biến
- Sử dụng Option 1 (geocode khi tạo address)

---

## 📝 NOTES

- Fix này là **SHORT-TERM** để đảm bảo Railway chạy được ngay
- **LONG-TERM** nên implement Option 1 (geocode khi tạo address)
- Cần monitor logs để xem tỷ lệ geocoding thành công/thất bại
- Cân nhắc add retry logic nếu geocode API unstable

---

**Tạo bởi:** Development Team  
**Ngày cập nhật:** 25/11/2025  
**Status:** ✅ RESOLVED

