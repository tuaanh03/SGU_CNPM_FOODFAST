# Location Service

Service quản lý địa chỉ, geocoding và dữ liệu địa phương Việt Nam.

## Chức năng

- Tìm kiếm gợi ý địa chỉ (autocomplete) sử dụng OpenStreetMap Nominatim
- Geocode địa chỉ thành tọa độ GPS (latitude, longitude)
- Lấy danh sách tỉnh/thành phố Việt Nam
- Lấy danh sách quận/huyện theo tỉnh
- Lấy danh sách phường/xã theo quận/huyện

## API Endpoints

### 1. Tìm kiếm địa chỉ
```
GET /search?q=123+nguyen+hue&limit=5
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "displayName": "123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM",
      "address": "123 Nguyễn Huệ",
      "ward": "Bến Nghé",
      "district": "Quận 1",
      "province": "TP.HCM",
      "latitude": 10.7629,
      "longitude": 106.6602
    }
  ]
}
```

### 2. Geocode địa chỉ
```
POST /geocode
Content-Type: application/json

{
  "address": "123 Nguyễn Huệ",
  "ward": "Bến Nghé",
  "district": "Quận 1",
  "province": "TP.HCM"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "latitude": 10.7629,
    "longitude": 106.6602,
    "formattedAddress": "123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM"
  }
}
```

### 3. Lấy danh sách tỉnh/thành phố
```
GET /provinces
GET /provinces?search=ha+noi
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "code": 1,
      "name": "Thành phố Hà Nội",
      "codename": "thanh_pho_ha_noi"
    }
  ]
}
```

### 4. Lấy danh sách quận/huyện
```
GET /districts/:provinceCode
GET /districts/79?search=quan+1
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "code": 760,
      "name": "Quận 1",
      "codename": "quan_1",
      "province_code": 79
    }
  ]
}
```

### 5. Lấy danh sách phường/xã
```
GET /wards/:districtCode
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "code": 26734,
      "name": "Phường Bến Nghé",
      "codename": "phuong_ben_nghe",
      "district_code": 760
    }
  ]
}
```

## Environment Variables

```
PORT=3006
NODE_ENV=development
```

## External APIs

1. **OpenStreetMap Nominatim** - Geocoding và search địa chỉ
   - URL: https://nominatim.openstreetmap.org
   - User-Agent: FoodDeliveryApp/1.0
   - Rate limit: 1 request/second
   - Cache: 30 ngày

2. **Vietnam Provinces API** - Dữ liệu địa phương VN
   - URL: https://provinces.open-api.vn/api
   - Free, unlimited
   - Cache: 7 ngày

## Caching Strategy

- **Geocoding results**: Cache 30 ngày (địa chỉ ít thay đổi)
- **Provinces/Districts/Wards**: Cache 7 ngày (dữ liệu tĩnh)
- Cache engine: NodeCache (in-memory)

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Start
pnpm start
```

## Docker

Service chạy trên port 3006

```bash
docker build -t location-service .
docker run -p 3006:3006 location-service
```

## Integration với Frontend

Frontend gọi qua API Gateway:

```javascript
// Tìm kiếm địa chỉ
GET http://localhost:3000/api/locations/search?q=nguyen+hue

// Lấy tỉnh/thành phố
GET http://localhost:3000/api/locations/provinces

// Lấy quận/huyện của TP.HCM (code: 79)
GET http://localhost:3000/api/locations/districts/79

// Lấy phường/xã của Quận 1 (code: 760)
GET http://localhost:3000/api/locations/wards/760

// Geocode địa chỉ
POST http://localhost:3000/api/locations/geocode
{
  "address": "123 Nguyễn Huệ",
  "ward": "Bến Nghé",
  "district": "Quận 1",
  "province": "TP.HCM"
}
```

## Notes

- Service này là **stateless**, không có database
- Tất cả dữ liệu được cache trong memory
- Không cần authentication (public endpoints)
- Tuân thủ rate limit của OpenStreetMap Nominatim (1 req/s)

