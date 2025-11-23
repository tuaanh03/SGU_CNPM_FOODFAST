# ✅ HOÀN THÀNH: TÌM NHÀ HÀNG GẦN TRÊN HOMEPAGE (10KM)

## 📝 TỔNG KẾT THAY ĐỔI

Đã chuyển logic **"Tìm nhà hàng gần"** từ CheckoutPage lên **Header + HomePage**

---

## 🎯 KIẾN TRÚC MỚI

### **Flow Chính:**

```
1. User mở website
   ↓
2. Header hiển thị địa chỉ mặc định (từ AddressContext)
   ↓
3. User click vào địa chỉ → Mở dialog chọn địa chỉ khác
   ↓
4. Khi địa chỉ thay đổi → HomePage tự động load nhà hàng gần (≤10km)
   ↓
5. Hiển thị danh sách nhà hàng với khoảng cách "Cách bạn X.X km"
   ↓
6. User chọn nhà hàng → Thêm món vào giỏ
   ↓
7. Checkout → CHỈ REVIEW đơn hàng + nhập ghi chú
```

---

## 🆕 CÁC FILE MỚI

### 1. **AddressContext**
📁 `frontend/cnpm-fooddelivery/src/contexts/address-context.tsx`

**Chức năng:**
- Quản lý địa chỉ global cho toàn app
- Auto-load danh sách địa chỉ của user
- Tự động chọn địa chỉ mặc định
- Lưu địa chỉ đã chọn vào localStorage
- Expose: `selectedAddress`, `setSelectedAddress`, `addresses`, `loading`, `refreshAddresses()`

**State Management:**
```typescript
{
  selectedAddress: Address | null,    // Địa chỉ đang chọn
  addresses: Address[],                // Danh sách địa chỉ
  loading: boolean,                    // Loading state
  setSelectedAddress: (addr) => void,  // Change address
  refreshAddresses: () => Promise      // Reload addresses
}
```

### 2. **AddressSelectorDialog**
📁 `frontend/cnpm-fooddelivery/src/components/AddressSelectorDialog.tsx`

**Chức năng:**
- Dialog để chọn địa chỉ giao hàng
- Hiển thị danh sách địa chỉ với:
  + Tên, SĐT
  + Địa chỉ đầy đủ
  + Badge "Mặc định"
  + Check icon cho địa chỉ đang chọn
- Hover effect & active state
- Click → Chọn địa chỉ → Đóng dialog

---

## 🔄 CÁC FILE ĐÃ CẬP NHẬT

### 1. **Navigation.tsx**
📁 `frontend/cnpm-fooddelivery/src/components/Navigation.tsx`

**Thay đổi:**
- ✅ Import `useAddress` hook
- ✅ Thêm state `showAddressDialog`
- ✅ Hiển thị địa chỉ đã chọn: `{ward}, {district}`
- ✅ Click → Mở AddressSelectorDialog
- ✅ Icon ChevronDown để chỉ có thể mở dialog
- ✅ Màu orange nếu chưa chọn địa chỉ

**UI Before:**
```
Header: [Logo] [📍 Quận 1, TP.HCM] [User Menu]
         ^--- Hardcoded, không click được
```

**UI After:**
```
Header: [Logo] [📍 Bến Nghé, Quận 1 ▼] [User Menu]
         ^--- Dynamic, click để đổi địa chỉ
```

### 2. **HomePage.tsx**
📁 `frontend/cnpm-fooddelivery/src/pages/HomePage.tsx`

**Thay đổi:**
- ✅ Import `useAddress`, `locationService`, `restaurantService`
- ✅ Lấy `selectedAddress` từ AddressContext
- ✅ useEffect watch `selectedAddress` → Tự động load nearby restaurants
- ✅ Thay thế `fetchStores()` bằng `fetchNearbyRestaurants()`:
  + Geocode nếu địa chỉ chưa có tọa độ
  + Gọi `restaurantService.getNearbyRestaurants({ lat, lng, radius: 10 })`
  + Convert `Restaurant` → `RestaurantItem`
  + Hiển thị khoảng cách: `distance: "2.5 km"`
  + Toast nếu không có nhà hàng nào

**Logic Flow:**
```typescript
useEffect(() => {
  if (selectedAddress) {
    fetchNearbyRestaurants();
  }
}, [selectedAddress]);
```

### 3. **CheckoutPage.tsx**
📁 `frontend/cnpm-fooddelivery/src/pages/CheckoutPage.tsx`

**Thay đổi:**
- ❌ BỎ: AddressSelector component
- ❌ BỎ: NearbyRestaurants component
- ❌ BỎ: Distance Warning Dialog
- ❌ BỎ: Logic chọn địa chỉ & nhà hàng
- ❌ BỎ: State `selectedAddress`, `nearbyRestaurants`, `loadingRestaurants`
- ✅ GIỮ: Review thông tin đơn hàng
- ✅ THÊM: Hiển thị địa chỉ giao hàng từ AddressContext (read-only)
- ✅ THÊM: Validate địa chỉ + nhà hàng trong giỏ hàng
- ✅ ĐƠN GIẢN: Chỉ có textarea "Ghi chú" và button "Đặt hàng"

**UI Before:**
```
CheckoutPage:
- [AddressSelector] ← Chọn địa chỉ
- [NearbyRestaurants] ← Chọn nhà hàng
- [Delivery Info Form] ← Nhập SĐT, địa chỉ
- [Order Summary]
```

**UI After:**
```
CheckoutPage:
- [Restaurant Info] ← Nhà hàng đã chọn (từ giỏ)
- [Delivery Address] ← Địa chỉ giao hàng (read-only, từ AddressContext)
- [Note Textarea] ← Ghi chú cho nhà hàng
- [Order Summary]
```

### 4. **App.tsx**
📁 `frontend/cnpm-fooddelivery/src/App.tsx`

**Thay đổi:**
- ✅ Import `AddressProvider`
- ✅ Wrap app với `<AddressProvider>`:
  ```tsx
  <AuthProvider>
    <AddressProvider>
      <CartProvider>
        <BrowserRouter>
          ...
        </BrowserRouter>
      </CartProvider>
    </AddressProvider>
  </AuthProvider>
  ```

---

## 📊 SO SÁNH WORKFLOW

### **CŨ (Checkout-based):**
```
1. User thêm món vào giỏ
2. Vào CheckoutPage
3. Chọn địa chỉ
4. Load nhà hàng gần
5. Chọn nhà hàng
6. Validate distance
7. Place order
```

### **MỚI (Homepage-based):**
```
1. User chọn địa chỉ trên Header
2. HomePage tự động load nhà hàng gần
3. User chọn nhà hàng & thêm món
4. Vào CheckoutPage → Chỉ review & đặt hàng
```

---

## ✅ ƯU ĐIỂM CỦA KIẾN TRÚC MỚI

### 1. **Better UX**
- ✅ User chọn địa chỉ TRƯỚC khi xem nhà hàng
- ✅ Chỉ hiển thị nhà hàng giao được (≤10km)
- ✅ Không waste time chọn nhà hàng xa khi checkout

### 2. **Cleaner Checkout**
- ✅ CheckoutPage đơn giản, tập trung vào payment
- ✅ Không có logic phức tạp về location
- ✅ Faster checkout flow

### 3. **Reusable AddressContext**
- ✅ Địa chỉ được manage global
- ✅ Các page khác có thể dùng: ProfilePage, MyOrderPage, etc.
- ✅ Persistent across navigation (localStorage)

### 4. **Performance**
- ✅ Load nearby restaurants một lần trên HomePage
- ✅ Không reload khi vào CheckoutPage
- ✅ Cache selectedAddress trong context

---

## 🔧 TECHNICAL DETAILS

### **API Calls Flow:**

#### **1. Khi user chọn địa chỉ:**
```
Navigation → setSelectedAddress(address)
  ↓
AddressContext updates
  ↓
HomePage useEffect triggered
  ↓
fetchNearbyRestaurants()
  ↓
locationService.geocode() (if needed)
  ↓
restaurantService.getNearbyRestaurants()
  ↓
API Gateway → GET /api/stores/nearby?lat=X&lng=Y&radius=10
  ↓
Restaurant Service → PostGIS query
  ↓
Return stores sorted by distance
```

#### **2. Khi user checkout:**
```
CheckoutPage loads
  ↓
Check: selectedAddress exists?
  ↓
Check: cart has restaurant?
  ↓
Display read-only info
  ↓
User clicks "Đặt hàng"
  ↓
orderService.createOrderFromCart({
  storeId: cart.restaurant.id,
  deliveryAddress: selectedAddress (formatted),
  contactPhone: selectedAddress.phone,
  note: formData.note
})
```

---

## 🧪 TESTING CHECKLIST

### **Manual Tests:**

- [ ] **Test 1: First Visit**
  - Mở trang → Header show "Chọn địa chỉ giao hàng" (orange)
  - Click → Dialog mở
  - Chọn địa chỉ → HomePage load nhà hàng gần
  
- [ ] **Test 2: Change Address**
  - Click địa chỉ trên header
  - Chọn địa chỉ khác
  - HomePage reload restaurants tự động
  
- [ ] **Test 3: No Restaurants**
  - Chọn địa chỉ xa (ví dụ: ngoại thành)
  - Kiểm tra: Toast "Không có nhà hàng nào trong 10km"
  - RestaurantList hiển thị empty state
  
- [ ] **Test 4: Add to Cart**
  - Chọn nhà hàng có distance < 10km
  - Thêm món vào giỏ
  - Check: cart.restaurant được set
  
- [ ] **Test 5: Checkout**
  - Vào CheckoutPage
  - Kiểm tra: Địa chỉ hiển thị read-only
  - Kiểm tra: Restaurant info hiển thị đúng
  - Place order thành công
  
- [ ] **Test 6: Persistence**
  - Chọn địa chỉ
  - Refresh trang
  - Kiểm tra: Địa chỉ vẫn được giữ (localStorage)

### **Edge Cases:**

- [ ] User chưa đăng nhập → Không có addresses → Header show "Chọn địa chỉ"
- [ ] User chưa có địa chỉ nào → Dialog show "Thêm địa chỉ mới"
- [ ] Geocoding fail → Toast error, không load restaurants
- [ ] API nearby fail → Toast error, show empty state

---

## 📡 API ENDPOINTS USED

### **Frontend → API Gateway:**

```typescript
// 1. Get user addresses
GET /api/addresses
Authorization: Bearer {token}

// 2. Geocode address (if no lat/lng)
POST /api/locations/geocode
Body: { address, ward, district, province }

// 3. Get nearby restaurants (≤10km)
GET /api/stores/nearby?lat={lat}&lng={lng}&radius=10

// 4. Create order
POST /api/order/create-from-cart
Authorization: Bearer {token}
Body: { storeId, deliveryAddress, contactPhone, note }
```

### **API Gateway → Services:**

```
/api/addresses → user-service:3001
/api/locations → location-service:3007 (if implemented)
/api/stores → restaurant-service:3004
/api/order → order-service:3002
```

---

## 🚀 DEPLOYMENT NOTES

### **Environment Variables:**

Không có env mới, dùng existing:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### **Database Requirements:**

1. **User Service:**
   - Address table có `latitude`, `longitude` columns
   - Index: `(latitude, longitude)`

2. **Restaurant Service:**
   - Store table có `latitude`, `longitude` columns  
   - Index: `(latitude, longitude)`
   - PostgreSQL với PostGIS extension

### **Browser Storage:**

localStorage keys:
- `selected_address_id`: ID của địa chỉ đang chọn

---

## 📝 MIGRATION GUIDE (Từ old → new)

### **Nếu user đang ở CheckoutPage (old version):**

1. User reload page → Redirect về HomePage
2. Chọn địa chỉ từ header
3. Chọn nhà hàng
4. Thêm món vào giỏ
5. Checkout

### **Data Migration:**

Không cần migration, vì:
- Address data đã có sẵn trong user-service
- Store data đã có latitude/longitude
- Chỉ cần ensure PostGIS extension enabled

---

## 🎉 KẾT LUẬN

Đã hoàn thành chuyển đổi workflow từ **Checkout-based** sang **Homepage-based** với:

✅ **AddressContext** - Global state management  
✅ **Header Address Selector** - Chọn địa chỉ dễ dàng  
✅ **HomePage auto-load** - Nhà hàng gần tự động  
✅ **Simplified Checkout** - Chỉ review + place order  
✅ **10km radius** - Giới hạn rõ ràng  
✅ **Better UX** - User flow tự nhiên hơn  
✅ **Không phá vỡ cấu trúc** - Reuse existing services  

**Ready to test!** 🚀

