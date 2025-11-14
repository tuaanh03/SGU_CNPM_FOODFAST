# 📊 HƯỚNG DẪN CÀI ĐẶT PROMETHEUS & GRAFANA CHO MONITORING

## 📋 Tổng Quan

Hệ thống monitoring sử dụng:
- **Prometheus**: Thu thập metrics từ các microservices
- **Grafana**: Visualization và dashboard

## 🔧 Cấu Hình Đã Thực Hiện

### 1. File `prometheus.yml` (Root Directory)

File này cấu hình Prometheus scrape metrics từ các services:

```yaml
Services được monitor:
- user-service        (port 8081)
- order-service       (port 8082)
- notification-service (port 8083)
- product-service     (port 3004)
- cart-service        (port 3006)
- payment-service     (port 4000)
- restaurant-service  (port 3005)
```

**Lưu ý**: Tất cả services phải expose endpoint `/actuator/prometheus` để Prometheus có thể scrape metrics.

### 2. Docker Compose Services

Đã thêm 2 services vào `docker-compose.yml`:

#### **Prometheus**
- **Image**: `prom/prometheus`
- **Port**: `9090:9090` ✅ (không conflict)
- **Volume**: `./prometheus.yml:/etc/prometheus/prometheus.yml`
- **Access**: http://localhost:9090

#### **Grafana**
- **Image**: `grafana/grafana`
- **Port**: `3001:3000` (host:container)
  - ⚠️ Đổi từ 3000 → 3001 vì api-gateway đã dùng port 3000
- **Access**: http://localhost:3001

## 🚀 Cách Sử Dụng

### Bước 1: Khởi động services

```bash
# Build và start tất cả services (bao gồm Prometheus + Grafana)
docker compose up -d

# Hoặc chỉ start Prometheus + Grafana
docker compose up -d prometheus grafana
```

### Bước 2: Kiểm tra Prometheus

1. Mở browser: **http://localhost:9090**
2. Vào **Status** → **Targets**
3. Kiểm tra trạng thái các services:
   - ✅ **UP**: Service đang hoạt động và expose metrics
   - ❌ **DOWN**: Service chưa expose metrics hoặc không chạy

### Bước 3: Cấu hình Grafana

1. Mở browser: **http://localhost:3001**
2. **Login** (lần đầu):
   - Username: `admin`
   - Password: `admin`
   - (Hệ thống sẽ yêu cầu đổi password)

3. **Add Data Source**:
   - Click **Configuration** (⚙️) → **Data Sources**
   - Click **Add data source**
   - Chọn **Prometheus**
   - Cấu hình:
     ```
     Name: Prometheus
     URL: http://prometheus:9090
     ```
   - Click **Save & Test**

4. **Import Dashboard**:
   - Click **+** → **Import**
   - Nhập Dashboard ID: `1860` (Node Exporter Full)
   - Hoặc `3662` (Prometheus 2.0 Overview)
   - Chọn Data Source: **Prometheus**
   - Click **Import**

## 📊 Port Mapping Summary

| Service           | Host Port | Container Port | URL                     |
|-------------------|-----------|----------------|-------------------------|
| api-gateway       | 3000      | 3000           | http://localhost:3000   |
| **Grafana**       | **3001**  | 3000           | http://localhost:3001   |
| **Prometheus**    | **9090**  | 9090           | http://localhost:9090   |
| user-service      | 1000      | 1000           | -                       |
| order-service     | 2000      | 2000           | -                       |
| product-service   | 3004      | 3004           | -                       |
| restaurant-service| 3005      | 3005           | -                       |
| cart-service      | 3006      | 3006           | -                       |
| location-service  | 3007      | 3007           | -                       |
| payment-service   | 4000      | 4000           | -                       |
| notification-service | 5001   | 5000           | -                       |

✅ **Không có conflict ports!**

## 🔍 Kiểm Tra Metrics Của Services

### Cách 1: Qua Prometheus UI

1. Mở http://localhost:9090
2. Vào tab **Graph**
3. Thử query:
   ```promql
   # Tổng số request
   http_requests_total
   
   # CPU usage
   process_cpu_seconds_total
   
   # Memory usage
   process_resident_memory_bytes
   ```

### Cách 2: Trực tiếp từ Service

Kiểm tra endpoint metrics của từng service:

```bash
# User Service
curl http://localhost:1000/actuator/prometheus

# Order Service
curl http://localhost:2000/actuator/prometheus

# Product Service
curl http://localhost:3004/actuator/prometheus

# Cart Service
curl http://localhost:3006/actuator/prometheus

# Payment Service
curl http://localhost:4000/actuator/prometheus
```

## ⚠️ Yêu Cầu Cho Các Services

Để Prometheus có thể scrape metrics, mỗi service cần:

### 1. Cài đặt Prometheus Client Library

**Node.js/TypeScript** (sử dụng `prom-client`):

```bash
npm install prom-client
```

**Ví dụ code**:

```typescript
import express from 'express';
import promClient from 'prom-client';

const app = express();

// Enable default metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Expose /actuator/prometheus endpoint
app.get('/actuator/prometheus', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(3004, () => {
  console.log('Product service running on port 3004');
});
```

### 2. Custom Metrics (Tùy chọn)

```typescript
import promClient from 'prom-client';

// Counter - Đếm số lượng events
const orderCounter = new promClient.Counter({
  name: 'orders_total',
  help: 'Total number of orders',
  labelNames: ['status']
});

// Histogram - Đo thời gian xử lý
const orderDuration = new promClient.Histogram({
  name: 'order_processing_duration_seconds',
  help: 'Order processing duration',
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Sử dụng
orderCounter.inc({ status: 'success' });
const timer = orderDuration.startTimer();
// ... xử lý order
timer();
```

## 🐛 Troubleshooting

### 1. Prometheus không thấy targets

**Nguyên nhân**: Services chưa expose metrics endpoint

**Giải pháp**:
- Kiểm tra service có endpoint `/actuator/prometheus`
- Kiểm tra service đang chạy: `docker ps`
- Xem logs: `docker logs <service-name>`

### 2. Grafana không kết nối được Prometheus

**Nguyên nhân**: URL sai hoặc network issue

**Giải pháp**:
- Dùng URL: `http://prometheus:9090` (không phải localhost)
- Kiểm tra cả 2 services cùng network: `docker network inspect payment-processing-microservices-main_network`

### 3. Targets hiển thị "DOWN"

**Nguyên nhân**: 
- Service chưa implement metrics endpoint
- Port mapping sai trong prometheus.yml

**Giải pháp**:
- Test endpoint: `curl http://localhost:<port>/actuator/prometheus`
- Kiểm tra logs Prometheus: `docker logs prometheus`

## 📈 Grafana Dashboard Recommendations

### Built-in Dashboards (Import by ID):

1. **Node Exporter Full** - ID: `1860`
   - System metrics (CPU, Memory, Disk, Network)

2. **Prometheus 2.0 Overview** - ID: `3662`
   - Prometheus metrics overview

3. **Docker Container & Host Metrics** - ID: `10619`
   - Docker containers monitoring

4. **Spring Boot Statistics** - ID: `6756` (nếu dùng Spring Boot)

### Custom Dashboard

Tạo dashboard riêng cho microservices:

1. Click **+** → **Dashboard** → **Add new panel**
2. Chọn metric từ Prometheus
3. Customize visualization (Graph, Gauge, Table, etc.)
4. Lưu dashboard

## 🔐 Production Best Practices

### 1. Grafana Security

Thêm vào `docker-compose.yml`:

```yaml
grafana:
  image: grafana/grafana
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=your_secure_password
    - GF_USERS_ALLOW_SIGN_UP=false
  volumes:
    - grafana_data:/var/lib/grafana
```

### 2. Prometheus Retention

Thêm vào `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.retention.time=30d'
  volumes:
    - prometheus_data:/prometheus
```

### 3. Add Volumes

Trong section `volumes:`:

```yaml
volumes:
  # ...existing volumes...
  prometheus_data:
  grafana_data:
```

## 📝 Logs & Debugging

```bash
# Xem logs Prometheus
docker logs prometheus -f

# Xem logs Grafana
docker logs grafana -f

# Restart services
docker compose restart prometheus grafana

# Rebuild nếu cần
docker compose up -d --build prometheus grafana
```

## ✅ Checklist Hoàn Thành

- [x] Tạo file `prometheus.yml` với cấu hình scrape targets
- [x] Thêm Prometheus service vào docker-compose.yml
- [x] Thêm Grafana service vào docker-compose.yml
- [x] Kiểm tra port conflicts (Grafana: 3001 thay vì 3000)
- [ ] Implement `/actuator/prometheus` endpoint cho các services
- [ ] Test Prometheus targets
- [ ] Cấu hình Grafana data source
- [ ] Import/Create dashboards

## 🎯 Next Steps

1. **Implement Metrics Endpoints**:
   - Cài `prom-client` cho các Node.js services
   - Expose `/actuator/prometheus` endpoint
   - Thêm custom metrics cho business logic

2. **Configure Grafana**:
   - Add Prometheus data source
   - Import dashboards
   - Tạo alerts

3. **Monitor**:
   - Theo dõi service health
   - Track business metrics
   - Set up alerting rules

---

**📧 Hỗ trợ**: Nếu gặp vấn đề, kiểm tra logs và đảm bảo tất cả services đã implement metrics endpoint.

**🚀 Ready to monitor!**

