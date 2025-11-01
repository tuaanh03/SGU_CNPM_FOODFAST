# Docker Setup - CNPM Food Delivery Frontend

## 📋 Tổng Quan

Frontend được containerize bằng Docker với kiến trúc multi-stage build:
- **Stage 1 (Builder)**: Build ứng dụng React/Vite với Node.js 20 Alpine
- **Stage 2 (Production)**: Serve ứng dụng bằng Nginx Alpine

## 📁 Các File Docker

### 1. **Dockerfile**
- Sử dụng Node.js 20 Alpine để build (image nhẹ)
- Sử dụng Nginx Alpine để serve production
- Multi-stage build giúp giảm kích thước image tối đa

### 2. **nginx.conf**
- Cấu hình cho Single Page Application (SPA)
- Hỗ trợ React Router (try_files)
- Tối ưu cache cho static assets
- Gzip compression để giảm băng thông
- Security headers cơ bản

### 3. **.dockerignore**
- Loại bỏ node_modules, dist khỏi build context
- Giảm thời gian build và kích thước image

## 🚀 Cách Sử Dụng

### Khởi động toàn bộ hệ thống:
```bash
docker-compose up -d
```

### Chỉ khởi động frontend:
```bash
docker-compose up -d frontend
```

### Xem logs của frontend:
```bash
docker-compose logs -f frontend
```

### Rebuild frontend sau khi thay đổi code:
```bash
docker-compose up -d --build frontend
```

### Dừng services:
```bash
docker-compose down
```

### Dừng và xóa volumes:
```bash
docker-compose down -v
```

## 🌐 Truy Cập Ứng Dụng

- **Frontend**: http://localhost hoặc http://localhost:80
- **API Gateway**: http://localhost:3000
- **Health Check**: http://localhost/health

## 🔌 Danh Sách Ports

| Service | Host Port | Container Port | Mô tả |
|---------|-----------|----------------|-------|
| Frontend | 80 | 80 | React App (Nginx) |
| API Gateway | 3000 | 3000 | Gateway Service |
| User Service | 1000 | 1000 | User Service |
| Order Service | 2000 | 2000 | Order Service |
| Product Service | 3004 | 3004 | Product Service |
| Restaurant Service | 3005 | 3005 | Restaurant Service |
| Cart Service | 3006 | 3006 | Cart Service |
| Payment Service | 4000 | 4000 | Payment Service |
| Notification Service | 5001 | 5000 | Notification Service |
| Redis | 6379 | 6379 | Cache & Sessions |
| Kafka | 9092 | 9092 | Message Broker |

## 📝 Lưu Ý Quan Trọng

1. **Dependencies**: Frontend phụ thuộc vào API Gateway, cần đảm bảo API Gateway đã chạy
2. **SPA Routing**: Nginx được cấu hình để handle client-side routing
3. **Cache**: Static assets (js, css, images) được cache 1 năm
4. **Health Check**: Endpoint `/health` để kiểm tra trạng thái container
5. **Hot Reload**: Không có hot reload trong Docker, cần rebuild sau mỗi thay đổi

## 🐛 Troubleshooting

### Container không start:
```bash
# Xem logs chi tiết
docker-compose logs frontend

# Xem trạng thái container
docker ps -a | grep frontend
```

### Rebuild từ đầu (no cache):
```bash
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Vào trong container để debug:
```bash
docker exec -it frontend sh
```

### Kiểm tra nginx config:
```bash
docker exec -it frontend nginx -t
```

### Xóa tất cả containers và images:
```bash
docker-compose down
docker system prune -a
```

## 🔧 Development Workflow

### Khi đang phát triển:
1. **Chạy local không dùng Docker** (nhanh hơn cho development):
   ```bash
   npm run dev
   ```

2. **Test với Docker trước khi commit**:
   ```bash
   docker-compose up -d --build frontend
   ```

### Khi deploy lên Azure (sau này):
- Sẽ cấu hình lại Dockerfile phù hợp với Azure Container Instances/App Service
- Có thể cần thêm environment variables cho API endpoints
- Có thể cần custom domain và SSL certificates

## 📦 Kích Thước Image

- **Builder Stage**: ~500MB (Node.js + dependencies)
- **Final Image**: ~25-30MB (chỉ Nginx + static files)

## 🛡️ Security

- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Không cache HTML files (luôn lấy mới nhất)

## 📚 Tài Liệu Tham Khảo

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [React Deployment](https://create-react-app.dev/docs/deployment/)

