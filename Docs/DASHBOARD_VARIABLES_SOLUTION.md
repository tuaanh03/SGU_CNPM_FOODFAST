# Giải pháp: Đồng bộ Dashboard Variables cho Prometheus & Loki

## 🔍 Vấn đề đã phát hiện

### Dashboard hiện tại có:
- ✅ Biến `instance` (Prometheus) - query metrics từ label `instance`
- ❌ Chưa có biến riêng cho Loki logs
- ❌ Loki logs sử dụng label `service`, không có label `instance`
- ❌ Khi filter logs, biến `$instance` không match với Loki streams

### Nguyên nhân:
```
Prometheus Metrics          vs          Loki Logs
==================                     ===========
Label: instance                        Label: service
Value: api-gateway:3000                Value: api-gateway
Query: up{instance="..."}              Query: {service="..."}
```

→ **Không tương thích!** Dashboard variable `$instance` không thể dùng để filter Loki logs.

---

## ✅ Giải pháp đã áp dụng

### 1. Giữ nguyên biến cho Prometheus
```json
{
  "name": "instance",
  "label": "Instance",
  "datasource": "prometheus",
  "query": "label_values(up{job=~\".*-service\"}, instance)"
}
```
→ Dùng cho **metrics panels** (CPU, Memory, Request Rate, etc.)

### 2. Thêm biến mới cho Loki
```json
{
  "name": "service",
  "label": "Service", 
  "datasource": "loki",
  "query": {
    "label": "service",
    "type": 1
  },
  "includeAll": true
}
```
→ Dùng cho **logs panels**

### 3. Thêm biến filter chi tiết
- **level**: Filter theo log level (info, error, warn, debug)
- **method**: Filter theo HTTP method (GET, POST, PUT, DELETE)
- **status**: Filter theo HTTP status code (200, 404, 500, etc.)

---

## 📊 Cách sử dụng trong Panels

### Panel Prometheus (Metrics)
```promql
# Sử dụng biến $instance
rate(http_requests_total{instance="$instance"}[1m])
up{instance="$instance"}
```

### Panel Loki (Logs)
```logql
# Sử dụng biến $service, $level, $method, $status
{service=~"$service"}
{service=~"$service", level=~"$level"}
{service=~"$service", method=~"$method", status=~"$status"}
```

---

## 🎯 Variables Dashboard hiện có

| Variable | Label | Datasource | Purpose | Include All |
|----------|-------|------------|---------|-------------|
| `instance` | Instance | Prometheus | Filter metrics by instance | ❌ No |
| `service` | Service | Loki | Filter logs by service | ✅ Yes |
| `level` | Log Level | Loki | Filter logs by level | ✅ Yes |
| `method` | HTTP Method | Loki | Filter logs by method | ✅ Yes |
| `status` | HTTP Status | Loki | Filter logs by status | ✅ Yes |

---

## 🔄 Workflow sử dụng

### Scenario 1: Monitor một service cụ thể
1. **Chọn Instance**: `api-gateway:3000` (cho metrics)
2. **Chọn Service**: `api-gateway` (cho logs)
3. **Kết quả**: 
   - Metrics panels hiển thị data của `api-gateway:3000`
   - Logs panels hiển thị logs của `api-gateway`

### Scenario 2: Debug errors
1. **Service**: `order-service`
2. **Level**: `error`
3. **Method**: `POST`
4. **Status**: `500`
5. **Query logs**: `{service="order-service", level="error", method="POST", status="500"}`

### Scenario 3: Monitor tất cả services
1. **Service**: `All`
2. **Level**: `error`
3. **Query**: `{service=~".*", level="error"}` → Tất cả errors từ mọi service

---

## 🛠️ Cấu hình đã sửa

### File: `grafana-microservices-dashboard.json`
```json
"templating": {
  "list": [
    {
      "name": "instance",
      "label": "Instance",
      "datasource": {"type": "prometheus"},
      "query": "label_values(up{job=~\".*-service\"}, instance)"
    },
    {
      "name": "service",
      "label": "Service",
      "datasource": {"type": "loki", "uid": "loki-datasource"},
      "query": {"label": "service", "type": 1},
      "includeAll": true
    },
    {
      "name": "level",
      "label": "Log Level",
      "datasource": {"type": "loki", "uid": "loki-datasource"},
      "query": {"label": "level", "type": 1},
      "includeAll": true
    },
    {
      "name": "method",
      "label": "HTTP Method",
      "datasource": {"type": "loki", "uid": "loki-datasource"},
      "query": {"label": "method", "type": 1},
      "includeAll": true
    },
    {
      "name": "status",
      "label": "HTTP Status",
      "datasource": {"type": "loki", "uid": "loki-datasource"},
      "query": {"label": "status", "type": 1},
      "includeAll": true
    }
  ]
}
```

---

## 📝 Labels có sẵn trong Loki (từ Promtail)

### Stream Labels (indexed):
- **service**: Tên service (user-service, order-service, etc.)
- **level**: Log level (info, error, warn, debug)
- **method**: HTTP method (GET, POST, PUT, DELETE, PATCH)
- **status**: HTTP status code (200, 201, 400, 404, 500, etc.)
- **container_name**: Tên container Docker
- **container_id**: ID container
- **stream**: stdout/stderr
- **job**: Nguồn log (docker, node-app-logs)

### Parsed Fields (not indexed - dùng trong pipeline):
- timestamp
- responseTime
- contentLength
- userAgent
- ip
- path

---

## ✨ Ví dụ Query thực tế

### 1. Xem tất cả logs của order-service
```logql
{service="order-service"}
```

### 2. Xem errors của payment-service
```logql
{service="payment-service", level="error"}
```

### 3. Xem tất cả HTTP 500 errors
```logql
{status="500"}
```

### 4. POST requests failed
```logql
{method="POST", status=~"4..|5.."}
```

### 5. Search text trong logs
```logql
{service="user-service"} |= "authentication failed"
```

### 6. Multiple services errors
```logql
{service=~"order-service|payment-service", level="error"}
```

### 7. Sử dụng variables
```logql
{service=~"$service", level=~"$level", method=~"$method", status=~"$status"}
```

---

## 🎨 Tạo Panel Logs mới

### Bước 1: Add Panel
1. Dashboard > Add > Visualization
2. Chọn datasource: **Loki**

### Bước 2: Query
```logql
{service=~"$service", level=~"$level"}
```

### Bước 3: Options
- ✅ Time
- ✅ Unique labels
- ✅ Common labels
- ✅ Wrap lines
- ✅ Prettify JSON

### Bước 4: Title
```
📋 Logs - $service | Level: $level
```

---

## 🚀 Test Dashboard

### 1. Restart Grafana (nếu cần)
```bash
docker-compose restart grafana
```

### 2. Kiểm tra Variables
1. Mở dashboard: `http://localhost:3000`
2. Kiểm tra dropdown variables ở trên cùng:
   - **Instance** (Prometheus) - API gateway:3000, order-service:3001, etc.
   - **Service** (Loki) - All, api-gateway, order-service, etc.
   - **Log Level** - All, info, error, warn, debug
   - **HTTP Method** - All, GET, POST, PUT, DELETE
   - **HTTP Status** - All, 200, 201, 400, 404, 500, etc.

### 3. Test Filter
1. Chọn Service: `order-service`
2. Chọn Level: `error`
3. Check logs panel → Should show only errors from order-service

### 4. Verify Labels
```bash
# Check labels trong Loki
curl -s "http://localhost:3100/loki/api/v1/labels" | jq .

# Expected output:
# {
#   "status": "success",
#   "data": ["service", "level", "method", "status", "container_name", ...]
# }

# Check values của label 'service'
curl -s "http://localhost:3100/loki/api/v1/label/service/values" | jq .

# Expected:
# {
#   "status": "success",
#   "data": ["api-gateway", "user-service", "order-service", ...]
# }
```

---

## 📚 Tài liệu chi tiết

Xem file: **`Docs/GRAFANA_LOKI_QUERY_GUIDE.md`** để:
- Hiểu chi tiết về LogQL syntax
- Các ví dụ query nâng cao
- Best practices
- Troubleshooting guide
- Hướng dẫn tạo dashboard mới
- Mở rộng thêm variables và panels

---

## ⚠️ Lưu ý

### 1. Label Cardinality
- ✅ **Tốt**: service, level, method, status (giá trị ít, cố định)
- ❌ **Tránh**: userId, orderId, requestId (quá nhiều giá trị unique)

### 2. Performance
- Filter by labels trước (indexed)
- Sau đó mới dùng text search `|=`
- Cuối cùng parse JSON `| json`

### 3. Multi-value Variables
- Khi `includeAll: true`, dùng `=~` thay vì `=`
- Ví dụ: `{service=~"$service"}` (không phải `{service="$service"}`)

### 4. Datasource UID
- Đảm bảo `"uid": "loki-datasource"` khớp với datasource name trong Grafana
- Check bằng: Settings > Data sources > Loki > UID

---

## 🎉 Kết quả

✅ Dashboard có 2 bộ variables riêng biệt:
- **Prometheus variables**: `instance` → dùng cho metrics panels
- **Loki variables**: `service`, `level`, `method`, `status` → dùng cho logs panels

✅ Không xung đột, hoạt động độc lập

✅ User có thể filter logs linh hoạt theo nhiều tiêu chí

✅ Dễ dàng mở rộng thêm variables mới trong tương lai

---

**Tạo bởi:** GitHub Copilot  
**Ngày:** 16/11/2025  
**Áp dụng cho:** Microservices Monitoring Dashboard with Prometheus + Loki + Grafana

