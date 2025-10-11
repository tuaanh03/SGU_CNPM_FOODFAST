# Restaurant Service

Service quản lý thông tin nhà hàng/cửa hàng trong hệ thống microservices.

## Chức năng

- Tạo cửa hàng mới (chỉ STORE_ADMIN)
- Lấy thông tin cửa hàng của mình
- Cập nhật thông tin cửa hàng
- Lấy danh sách tất cả cửa hàng (public)
- Lấy thông tin cửa hàng theo ID (public)
- Kiểm tra user có store hay chưa (internal endpoint)

## API Endpoints

### Public Routes
- `GET /stores` - Lấy danh sách cửa hàng
- `GET /stores/:id` - Lấy thông tin cửa hàng theo ID

### Protected Routes (STORE_ADMIN)
- `POST /stores` - Tạo cửa hàng mới
- `GET /stores/my/store` - Lấy thông tin cửa hàng của mình
- `PUT /stores/my/store` - Cập nhật thông tin cửa hàng

### Internal Routes
- `GET /stores/internal/check/:ownerId` - Kiểm tra user có store chưa

## Environment Variables

```
PORT=3005
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=postgresql://postgres:postgres@restaurant-db:5432/restaurant_db?schema=public
```

## Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build
pnpm run build

# Start
pnpm start
```

## Docker

Service này chạy trên port 3005 và sử dụng PostgreSQL database riêng biệt (restaurant-db).
PORT=3005
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=postgresql://postgres:postgres@restaurant-db:5432/restaurant_db?schema=public

