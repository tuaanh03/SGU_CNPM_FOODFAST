# 📊 HƯỚNG DẪN EXPORT METRICS CHO MICROSERVICES

## ✅ Hoàn Thành - Cấu Hình Metrics Cho Tất Cả Services

### 🔍 Tổng Quan

Đã implement **Prometheus metrics export** cho tất cả 7 services:
- ✅ user-service
- ✅ product-service
- ✅ order-service
- ✅ cart-service
- ✅ payment-service
- ✅ restaurant-service
- ✅ notification-service

---

## 🎯 Không Cần File `application.yml`

**Lý do**: File `application.yml` là config của **Spring Boot (Java)**, nhưng các services của bạn sử dụng **Node.js/TypeScript** với Express.

**Thay vào đó**, tôi đã implement metrics bằng cách:
1. Cài đặt `prom-client` library (Prometheus client cho Node.js)
2. Tạo file `src/lib/metrics.ts` cho mỗi service
3. Export endpoint `/actuator/prometheus` trong mỗi service

---

## 📁 Cấu Trúc Files Đã Tạo

### Mỗi Service Có:

```
backend/services/<service-name>/
├── package.json                    # ✅ Đã thêm "prom-client": "^15.1.0"
└── src/
    ├── lib/
    │   └── metrics.ts              # ✅ MỚI - Metrics registry + custom metrics
    └── server.ts                   # ✅ CẬP NHẬT - Thêm middleware + endpoint
```

---

## 🔧 Chi Tiết Implementation

### 1. File `src/lib/metrics.ts` (Ví dụ: user-service)

```typescript
import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({ 
  register,
  prefix: 'user_service_',
});

// Custom metrics
export const httpRequestCounter = new promClient.Counter({
  name: 'user_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'user_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export default register;
```

### 2. Update `src/server.ts` (Mẫu chung cho tất cả services)

```typescript
import metricsRegister, { httpRequestCounter, httpRequestDuration } from "./lib/metrics";

// Metrics middleware - track all HTTP requests
server.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestCounter.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode,
    });
    
    httpRequestDuration.observe(
      {
        method: req.method,
        route: route,
        status_code: res.statusCode,
      },
      duration
    );
  });
  
  next();
});

// Prometheus metrics endpoint
server.get("/actuator/prometheus", async (req: Request, res: Response) => {
  res.set("Content-Type", metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Health Check Route
server.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Service is healthy",
    service: "<service-name>",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});
```

---

## 📊 Metrics Được Export

### Default Metrics (Tự động thu thập)

Mỗi service tự động export các metrics sau:
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_size_total_bytes` - Heap memory
- `nodejs_heap_size_used_bytes` - Heap used
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles` - Active handles
- `nodejs_active_requests` - Active requests

### Custom Metrics (Đã thêm cho mỗi service)

#### 1. **User Service** (`user-service`)
```
user_service_http_requests_total         # Total HTTP requests
user_service_http_request_duration_seconds # Request duration
user_service_auth_total                   # Authentication attempts
user_service_active_users                 # Active users count
```

#### 2. **Product Service** (`product-service`)
```
product_service_http_requests_total
product_service_http_request_duration_seconds
product_service_products_total            # Total products operations
product_service_categories_total          # Total categories operations
```

#### 3. **Order Service** (`order-service`)
```
order_service_http_requests_total
order_service_http_request_duration_seconds
order_service_orders_total                # Total orders by status
order_service_processing_duration_seconds # Order processing time
```

#### 4. **Cart Service** (`cart-service`)
```
cart_service_http_requests_total
cart_service_http_request_duration_seconds
cart_service_operations_total             # Cart operations (add/remove)
cart_service_active_carts                 # Active carts in Redis
```

#### 5. **Payment Service** (`payment-service`)
```
payment_service_http_requests_total
payment_service_http_request_duration_seconds
payment_service_payments_total            # Total payments by provider
payment_service_payment_amount            # Payment amount distribution
```

#### 6. **Restaurant Service** (`restaurant-service`)
```
restaurant_service_http_requests_total
restaurant_service_http_request_duration_seconds
restaurant_service_restaurants_total      # Restaurant operations
restaurant_service_active_restaurants     # Active restaurants count
```

#### 7. **Notification Service** (`notification-service`)
```
notification_service_http_requests_total
notification_service_http_request_duration_seconds
notification_service_notifications_total  # Total notifications sent
notification_service_emails_total         # Total emails sent
```

---

## 🚀 Cách Sử Dụng

### Bước 1: Install Dependencies

Rebuild các services để cài đặt `prom-client`:

```bash
# Rebuild tất cả services
docker compose build

# Hoặc rebuild từng service
docker compose build user-service
docker compose build product-service
docker compose build order-service
docker compose build cart-service
docker compose build payment-service
docker compose build restaurant-service
docker compose build notification-service
```

### Bước 2: Start Services

```bash
docker compose up -d
```

### Bước 3: Kiểm Tra Metrics Endpoints

Test từng service để đảm bảo metrics được export:

```bash
# User Service (port 1000)
curl http://localhost:1000/actuator/prometheus

# Product Service (port 3004)
curl http://localhost:3004/actuator/prometheus

# Order Service (port 2000)
curl http://localhost:2000/actuator/prometheus

# Cart Service (port 3006)
curl http://localhost:3006/actuator/prometheus

# Payment Service (port 4000)
curl http://localhost:4000/actuator/prometheus

# Restaurant Service (port 3005)
curl http://localhost:3005/actuator/prometheus

# Notification Service (port 5001)
curl http://localhost:5001/actuator/prometheus
```

**Expected Output**:
```
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 0.123

# HELP user_service_http_requests_total Total number of HTTP requests
# TYPE user_service_http_requests_total counter
user_service_http_requests_total{method="GET",route="/",status_code="200"} 5

...
```

### Bước 4: Kiểm Tra Prometheus

1. Mở Prometheus UI: http://localhost:9090
2. Vào **Status** → **Targets**
3. Tất cả services phải hiển thị **UP** (màu xanh)

### Bước 5: Visualize trong Grafana

1. Mở Grafana: http://localhost:3001
2. Login (admin/admin)
3. Add Prometheus data source: `http://prometheus:9090`
4. Tạo dashboard hoặc import dashboard có sẵn

---

## 📈 Query Examples (Prometheus)

### Tổng số requests cho mỗi service
```promql
sum(rate(user_service_http_requests_total[5m])) by (service)
sum(rate(product_service_http_requests_total[5m])) by (service)
sum(rate(order_service_http_requests_total[5m])) by (service)
```

### Request duration trung bình
```promql
rate(user_service_http_request_duration_seconds_sum[5m]) / rate(user_service_http_request_duration_seconds_count[5m])
```

### CPU Usage của tất cả services
```promql
rate(process_cpu_seconds_total[5m])
```

### Memory Usage
```promql
process_resident_memory_bytes / 1024 / 1024
```

### Request rate theo HTTP method
```promql
sum(rate(user_service_http_requests_total[5m])) by (method)
```

### Error rate (4xx, 5xx)
```promql
sum(rate(user_service_http_requests_total{status_code=~"[45].."}[5m])) by (status_code)
```

---

## 🔍 Troubleshooting

### 1. Endpoint `/actuator/prometheus` trả về 404

**Nguyên nhân**: Service chưa rebuild sau khi thêm code

**Giải pháp**:
```bash
docker compose build <service-name>
docker compose up -d <service-name>
```

### 2. Prometheus targets hiển thị "DOWN"

**Nguyên nhân**: Service chưa chạy hoặc port sai

**Giải pháp**:
```bash
# Kiểm tra service đang chạy
docker ps | grep <service-name>

# Xem logs
docker logs <service-name>

# Test endpoint trực tiếp
curl http://localhost:<port>/actuator/prometheus
```

### 3. Metrics không hiển thị data

**Nguyên nhân**: Chưa có traffic đến service

**Giải pháp**:
- Gọi một vài API requests đến service
- Đợi 10-30 giây để Prometheus scrape
- Refresh Prometheus UI

---

## 📝 Build Commands Cheat Sheet

```bash
# Build tất cả services
docker compose build

# Build specific service
docker compose build user-service

# Rebuild without cache
docker compose build --no-cache user-service

# Start services
docker compose up -d

# Restart service sau khi build
docker compose restart user-service

# Xem logs
docker compose logs -f user-service

# Test metrics endpoint
curl http://localhost:1000/actuator/prometheus | head -20
```

---

## ✅ Checklist Implementation

- [x] Install `prom-client` vào tất cả 7 services
- [x] Tạo `src/lib/metrics.ts` cho mỗi service
- [x] Update `src/server.ts` để export metrics
- [x] Thêm metrics middleware để track HTTP requests
- [x] Thêm endpoint `/actuator/prometheus`
- [x] Thêm endpoint `/health` cho health check
- [x] Tạo custom metrics cho từng service
- [ ] Rebuild Docker containers (CẦN THỰC HIỆN)
- [ ] Test metrics endpoints
- [ ] Verify Prometheus scraping
- [ ] Create Grafana dashboards

---

## 🎯 Next Steps

### 1. Rebuild Services
```bash
docker compose build
docker compose up -d
```

### 2. Test Metrics
```bash
# Test tất cả endpoints
for port in 1000 3004 2000 3006 4000 3005 5001; do
  echo "Testing port $port..."
  curl -s http://localhost:$port/actuator/prometheus | head -5
  echo ""
done
```

### 3. Configure Grafana Dashboards
- Import Node.js dashboard (ID: 11159)
- Create custom dashboards for business metrics
- Set up alerts

---

## 📚 Documentation References

- **prom-client**: https://github.com/siimon/prom-client
- **Prometheus**: https://prometheus.io/docs/
- **Grafana**: https://grafana.com/docs/

---

## 🎉 Kết Luận

**KHÔNG CẦN** file `application.yml` vì:
- ✅ Services dùng Node.js, không phải Spring Boot
- ✅ Đã implement metrics bằng `prom-client` library
- ✅ Tất cả services đã có endpoint `/actuator/prometheus`
- ✅ Prometheus sẽ tự động scrape metrics từ các endpoints này

**Bước tiếp theo**: Rebuild containers và test!

```bash
# Rebuild và start
docker compose build
docker compose up -d

# Kiểm tra
curl http://localhost:1000/actuator/prometheus
```

**🚀 Ready for monitoring!**

