# Admin Dashboard - Drone Delivery Management System

Admin Dashboard cho hệ thống quản lý giao hàng bằng Drone.

## Tính năng

### 1. Dashboard Tổng Quan
- Thống kê số lượng đơn hàng chờ phê duyệt
- Thống kê đơn hàng đang giao
- Thống kê đơn hàng đã hoàn thành
- Số lượng drone sẵn sàng

### 2. Hàng Đợi Dispatch (Dispatch Queue)
- Xem danh sách tất cả đơn hàng chờ phê duyệt
- Thông tin chi tiết: Mã đơn hàng, tên khách hàng, nhà hàng, địa chỉ
- Thông tin lộ trình: Khoảng cách, thời gian ước tính
- Click vào đơn hàng để xem chi tiết

### 3. Chi Tiết Đơn Hàng
- Xem đầy đủ thông tin đơn hàng
- Thông tin khách hàng và nhà hàng
- Danh sách món ăn và tổng tiền
- Thông tin lộ trình chi tiết

### 4. Phê Duyệt Đơn Hàng
- Nút "Phê Duyệt & Chọn Drone" - Hiển thị danh sách drone phù hợp
- Nút "Từ Chối Đơn Hàng" - Từ chối đơn hàng

### 5. Chọn Drone
- Danh sách drone phù hợp dựa trên:
  - Pin (> 30%)
  - Tải trọng (đủ cho đơn hàng)
  - Trạng thái (Available)
- Thông tin hiển thị: Tên, Model, Pin, Tải trọng, Khoảng cách
- Sắp xếp theo khoảng cách gần nhất

### 6. Bản Đồ Lộ Trình
- Hiển thị bản đồ mô phỏng (mock)
- Marker điểm đi (nhà hàng)
- Marker điểm đến (khách hàng)
- Marker vị trí drone
- Đường đi từ nhà hàng đến khách hàng
- Thông tin lộ trình: Khoảng cách, thời gian

## Mock Data

Hệ thống hiện tại sử dụng mock data để demo các tính năng:

### Đăng nhập
- **Email**: admin@example.com
- **Password**: admin123

### Mock Orders
- 5 đơn hàng mẫu với trạng thái "Chờ phê duyệt"
- Thông tin đầy đủ: Khách hàng, nhà hàng, món ăn, lộ trình

### Mock Drones
- 7 drone mẫu với các thông số khác nhau
- Pin từ 20% - 95%
- Tải trọng từ 2kg - 5.5kg
- Các trạng thái: Available, In Use, Charging

## Cài đặt

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Cấu trúc thư mục

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── DroneSelectionDialog.tsx
│   ├── RouteMapDialog.tsx
│   └── ProtectedRoute.tsx
├── pages/              # Pages
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── DispatchQueuePage.tsx
│   ├── OrderDetailPage.tsx
│   └── NotFound.tsx
├── contexts/           # React contexts
│   └── auth-context.tsx
├── services/           # Services & utilities
│   └── mockData.ts
├── lib/               # Utilities
│   └── utils.ts
└── App.tsx            # Main app component
```

## Workflow

1. **Đăng nhập** vào hệ thống
2. Xem **Dashboard** tổng quan
3. Vào **Hàng đợi Dispatch** để xem đơn hàng chờ phê duyệt
4. Click vào đơn hàng để xem **Chi tiết**
5. Click **"Phê Duyệt & Chọn Drone"**
6. Chọn drone phù hợp từ danh sách
7. Xem **Bản đồ lộ trình** sau khi chọn drone

## Công nghệ sử dụng

- **React 19** - UI Library
- **TypeScript** - Type safety
- **React Router 7** - Routing
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI Components
- **Lucide React** - Icons
- **date-fns** - Date formatting
- **Sonner** - Toast notifications
- **Vite** - Build tool

## Tích hợp Backend (Tương lai)

Hiện tại sử dụng mock data. Để tích hợp với backend:

1. Tạo API service trong `src/services/api.ts`
2. Thay thế mock data bằng API calls
3. Xử lý authentication với JWT tokens
4. WebSocket cho real-time updates
5. Tích hợp Google Maps API hoặc Leaflet cho bản đồ thực

## Notes

- Tất cả dữ liệu hiện tại là mock data
- Bản đồ là visualization đơn giản, chưa tích hợp Google Maps/Leaflet
- Authentication chỉ lưu trong localStorage (demo purpose)
- Cần thêm error handling và validation cho production

