# Hướng dẫn Query Loki và Grafana Dashboard Variables

## 📚 Mục lục
1. [Giới thiệu về Labels trong Loki](#giới-thiệu-về-labels-trong-loki)
2. [Cấu trúc Dashboard Variables](#cấu-trúc-dashboard-variables)
3. [Các loại Query cơ bản](#các-loại-query-cơ-bản)
4. [Tạo Variables trong Grafana](#tạo-variables-trong-grafana)
5. [LogQL Query Examples](#logql-query-examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## 🏷️ Giới thiệu về Labels trong Loki

### Labels hiện có trong hệ thống (từ Promtail config):
- **service**: Tên service (user-service, order-service, payment-service, etc.)
- **level**: Log level (info, error, warn, debug)
- **method**: HTTP method (GET, POST, PUT, DELETE, PATCH)
- **status**: HTTP status code (200, 201, 400, 404, 500, etc.)
- **container_name**: Tên container Docker
- **container_id**: ID của container
- **stream**: stdout hoặc stderr
- **job**: Nguồn log (docker, node-app-logs)

### Sự khác biệt giữa Prometheus và Loki:
| Aspect | Prometheus (Metrics) | Loki (Logs) |
|--------|---------------------|-------------|
| Label chính | `instance` (host:port) | `service` (service name) |
| Datasource | Prometheus | Loki |
| Query Language | PromQL | LogQL |
| Variable Query | `label_values(metric, label)` | Label selector + type |

---

## 🔧 Cấu trúc Dashboard Variables

### 1. Variable cho Prometheus Metrics (instance)
```json
{
  "datasource": {
    "type": "prometheus",
    "uid": "PBFA97CFB590B2093"
  },
  "includeAll": false,
  "label": "Instance",
  "name": "instance",
  "query": "label_values(up{job=~\".*-service\"}, instance)",
  "refresh": 1,
  "sort": 1,
  "type": "query"
}
```

**Giải thích:**
- `type: "query"`: Lấy giá trị từ Prometheus query
- `query`: PromQL để lấy tất cả giá trị của label `instance` từ metric `up`
- `refresh: 1`: Auto refresh khi dashboard load
- `includeAll: false`: Không có option "All"

**Sử dụng trong panel:**
```promql
up{instance="$instance"}
rate(http_requests_total{instance="$instance"}[1m])
```

---

### 2. Variable cho Loki Logs (service)
```json
{
  "datasource": {
    "type": "loki",
    "uid": "loki-datasource"
  },
  "includeAll": true,
  "label": "Service",
  "name": "service",
  "query": {
    "label": "service",
    "refId": "LokiVariableQueryEditor-VariableQuery",
    "stream": "",
    "type": 1
  },
  "refresh": 1,
  "sort": 1,
  "type": "query"
}
```

**Giải thích:**
- `datasource.type: "loki"`: Sử dụng Loki datasource
- `query.label: "service"`: Lấy tất cả giá trị của label `service`
- `query.type: 1`: Type 1 = Label values query
- `includeAll: true`: Có option "All" để chọn tất cả services

**Sử dụng trong panel:**
```logql
{service=~"$service"}
{service=~"$service"} |= "error"
{service=~"$service", level="error"}
```

---

### 3. Variable cho Log Level
```json
{
  "datasource": {
    "type": "loki",
    "uid": "loki-datasource"
  },
  "includeAll": true,
  "label": "Log Level",
  "name": "level",
  "query": {
    "label": "level",
    "type": 1
  },
  "refresh": 1,
  "type": "query"
}
```

**Sử dụng:**
```logql
{service="order-service", level=~"$level"}
{level=~"$level"} | json
```

---

### 4. Variable cho HTTP Method
```json
{
  "datasource": {
    "type": "loki",
    "uid": "loki-datasource"
  },
  "includeAll": true,
  "label": "HTTP Method",
  "name": "method",
  "query": {
    "label": "method",
    "type": 1
  },
  "refresh": 1,
  "type": "query"
}
```

**Sử dụng:**
```logql
{service="api-gateway", method=~"$method"}
{method=~"$method", status=~"5.."} 
```

---

### 5. Variable cho HTTP Status
```json
{
  "datasource": {
    "type": "loki",
    "uid": "loki-datasource"
  },
  "includeAll": true,
  "label": "HTTP Status",
  "name": "status",
  "query": {
    "label": "status",
    "type": 1
  },
  "refresh": 1,
  "type": "query"
}
```

**Sử dụng:**
```logql
{service="payment-service", status=~"$status"}
{status=~"4..|5.."} # All errors
{status="200"} # Success only
```

---

## 📊 Các loại Query cơ bản

### 1. Label Filter (Stream Selector)
```logql
# Query logs của một service
{service="user-service"}

# Query logs của nhiều services
{service=~"user-service|order-service"}

# Query logs với multiple labels
{service="order-service", level="error"}

# Query với regex
{service=~".*-service", status=~"5.."}

# Query với negative match
{service="payment-service", level!="debug"}
```

### 2. Line Filter
```logql
# Tìm logs chứa text "error"
{service="order-service"} |= "error"

# Tìm logs KHÔNG chứa text "health"
{service="api-gateway"} != "health"

# Tìm logs chứa regex pattern
{service="user-service"} |~ "user.*created"

# Tìm logs KHÔNG khớp regex
{service="cart-service"} !~ "debug.*trace"

# Chain multiple filters
{service="order-service"} |= "payment" |= "failed" != "retry"
```

### 3. JSON Parser
```logql
# Parse JSON và filter
{service="order-service"} | json

# Parse và filter by field
{service="user-service"} | json | email =~ ".*@gmail.com"

# Parse và extract fields
{service="payment-service"} | json | line_format "{{.method}} {{.path}} - {{.status}}"
```

### 4. Pattern Parser
```logql
# Parse structured logs
{service="nginx"} | pattern `<ip> - - <_> "<method> <uri> <_>" <status> <_>`

# Sử dụng extracted fields
{service="nginx"} | pattern `<_> <status> <_>` | status >= 400
```

### 5. Label Format
```logql
# Add/modify labels from parsed fields
{service="order-service"} 
  | json 
  | label_format user_id={{.userId}}, order_id={{.orderId}}
```

### 6. Line Format
```logql
# Format output line
{service="payment-service"} 
  | json 
  | line_format "{{.timestamp}} [{{.level}}] {{.message}}"

# Using template with conditions
{service="user-service"} 
  | json 
  | line_format "{{ if eq .level \"error\" }}🔴{{ else }}✅{{ end }} {{.message}}"
```

---

## 🎯 Tạo Variables trong Grafana

### Bước 1: Vào Dashboard Settings
1. Mở dashboard cần thêm variable
2. Click vào ⚙️ (Settings) ở góc trên bên phải
3. Chọn tab **Variables**
4. Click **Add variable** hoặc **New variable**

### Bước 2: Cấu hình Variable

#### A. Variable Type: Query

**General:**
- **Name**: `service` (tên dùng trong query: `$service`)
- **Label**: `Service` (tên hiển thị trên dashboard)
- **Description**: "Select microservice" (optional)

**Query Options:**
- **Data source**: Chọn **Loki** (hoặc tên datasource Loki của bạn)
- **Query type**: **Label values**
- **Label**: `service`
- **Stream selector**: `{job=~".*"}` (optional - để filter nguồn)

**Selection Options:**
- **Multi-value**: ✅ Tích (cho phép chọn nhiều)
- **Include All option**: ✅ Tích (thêm option "All")
- **Custom all value**: Để trống hoặc `.*` (regex match all)

**Value groups/tags**: Để trống (optional)

**Preview of values**: Sẽ hiện danh sách services nếu config đúng

**Refresh**: `On Dashboard Load` (tự động refresh)

#### B. Variable Type: Custom

Dùng khi muốn hard-code các giá trị:

**General:**
- **Name**: `environment`
- **Label**: `Environment`

**Custom Options:**
- **Values separated by comma**: `dev,staging,production`

**Selection Options:**
- **Multi-value**: Tùy chọn
- **Include All option**: Tùy chọn

#### C. Variable Type: Text box

Cho phép user nhập text tự do:

**General:**
- **Name**: `search_term`
- **Label**: `Search`

**Text options:**
- **Default value**: `error`

**Sử dụng:**
```logql
{service="$service"} |= "$search_term"
```

---

## 💡 LogQL Query Examples

### Example 1: Query logs của service cụ thể
```logql
{service="order-service"}
```

### Example 2: Query error logs
```logql
{service="order-service", level="error"}
```

### Example 3: Query HTTP errors (4xx, 5xx)
```logql
{service="api-gateway", status=~"4..|5.."}
```

### Example 4: Query specific method
```logql
{service="payment-service", method="POST"}
```

### Example 5: Combine với variables
```logql
{service=~"$service", level=~"$level", method=~"$method"}
```

### Example 6: Search text trong logs
```logql
{service="user-service"} |= "authentication failed"
```

### Example 7: Parse JSON và filter
```logql
{service="order-service"} 
  | json 
  | orderId != "" 
  | userId != ""
```

### Example 8: Count error rate
```logql
sum(rate({service="payment-service", level="error"}[5m])) by (service)
```

### Example 9: Top 10 slowest requests
```logql
topk(10, 
  avg_over_time({service="api-gateway"} 
    | json 
    | unwrap responseTime [5m]
  ) by (path)
)
```

### Example 10: Filter by status code range
```logql
# Client errors (400-499)
{service=~"$service", status=~"4.."}

# Server errors (500-599)
{service=~"$service", status=~"5.."}

# Successful requests (200-299)
{service=~"$service", status=~"2.."}

# All errors
{service=~"$service", status=~"4..|5.."}
```

### Example 11: Multi-service aggregation
```logql
sum by (service) (
  rate({service=~"order-service|payment-service|user-service"}[1m])
)
```

### Example 12: Extract và format field
```logql
{service="payment-service"} 
  | json 
  | line_format "Payment {{.paymentId}}: {{.status}} - {{.amount}} VND"
```

---

## 🎨 Sử dụng Variables trong Panels

### 1. Logs Panel
**Query:**
```logql
{service=~"$service", level=~"$level", method=~"$method", status=~"$status"}
```

**Options:**
- **Display time**: ✅
- **Unique labels**: ✅
- **Common labels**: ✅
- **Wrap lines**: ✅

### 2. Time Series Panel (Log metrics)
**Query:**
```logql
sum(rate({service=~"$service", level="error"}[1m])) by (service)
```

**Legend:**
```
{{service}} - Errors
```

### 3. Stat Panel (Total count)
**Query:**
```logql
sum(count_over_time({service=~"$service", level="error"}[24h]))
```

**Options:**
- **Calculation**: Last
- **Color mode**: Value
- **Graph mode**: Area

### 4. Bar Chart (Requests by status)
**Query:**
```logql
sum by (status) (
  count_over_time({service="$service", status=~".*"}[1h])
)
```

### 5. Table Panel (Detailed logs)
**Query:**
```logql
{service=~"$service", level=~"$level"} 
  | json 
  | line_format "{{.timestamp}}|{{.level}}|{{.method}}|{{.path}}|{{.status}}|{{.message}}"
```

**Transform:**
- Add transformation: **Extract fields**
- Source: `Line`
- Format: `CSV` hoặc `Auto`
- Separator: `|`

---

## ✅ Best Practices

### 1. Label Cardinality
❌ **Tránh:**
```yaml
# Trong promtail-config.yaml - KHÔNG nên làm
- labels:
    user_id:      # Too many unique values
    order_id:     # Too many unique values
    request_id:   # Too many unique values
```

✅ **Nên:**
```yaml
# Labels với cardinality thấp
- labels:
    service:      # ~10 services
    level:        # 4-5 levels (info, warn, error, debug)
    method:       # 5-7 methods (GET, POST, PUT, etc.)
    status:       # ~20-30 status codes
```

### 2. Filter Order (Performance)
✅ **Hiệu quả:**
```logql
# Filter by labels TRƯỚC (indexed)
{service="order-service", level="error"} 
  |= "payment" 
  | json
```

❌ **Không hiệu quả:**
```logql
# Parse tất cả logs trước rồi mới filter
{service="order-service"} 
  | json 
  | level = "error"
  |= "payment"
```

### 3. Time Range
- Sử dụng time range hợp lý (không query quá xa)
- Dùng `$__interval` cho rate queries
- Cache results với `min step`

### 4. Variable Dependencies
Tạo variables có thứ tự phụ thuộc:

```json
// Variable 1: service
{
  "name": "service",
  "query": {"label": "service"}
}

// Variable 2: level (phụ thuộc service)
{
  "name": "level",
  "query": {
    "label": "level",
    "stream": "{service=\"$service\"}"  // Filter by service
  }
}
```

### 5. Naming Convention
- Variables: lowercase với underscore (`service`, `log_level`, `http_method`)
- Labels: camelCase hoặc lowercase (`service`, `containerName`)
- Display names: Title Case (`Service`, `Log Level`, `HTTP Method`)

---

## 🔍 Troubleshooting

### Vấn đề 1: Variable không hiển thị giá trị

**Nguyên nhân:**
- Datasource sai
- Label không tồn tại trong Loki
- Query syntax sai

**Giải pháp:**
```bash
# 1. Kiểm tra labels có trong Loki
curl -s "http://localhost:3100/loki/api/v1/labels" | jq .

# 2. Kiểm tra values của label cụ thể
curl -s "http://localhost:3100/loki/api/v1/label/service/values" | jq .

# 3. Kiểm tra Promtail logs
docker logs promtail 2>&1 | grep -i error
```

**Fix trong Grafana:**
- Vào Settings > Variables > Variable name
- Check datasource UID match
- Check query syntax
- Click "Preview of values" để test

---

### Vấn đề 2: Labels không xuất hiện trong logs

**Nguyên nhân:**
- Promtail pipeline chưa parse đúng
- JSON structure không match
- Labels stage thiếu

**Giải pháp:**
```yaml
# Trong promtail-config.yaml
pipeline_stages:
  # 1. Parse JSON
  - json:
      expressions:
        level: level
        method: method
        status: status
  
  # 2. PHẢI có labels stage
  - labels:
      level:
      method:
      status:
  
  # 3. Debug output
  - output:
      source: log
```

**Test:**
```bash
# Restart Promtail
docker-compose restart promtail

# Check logs được gửi đến Loki
curl -G "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={service="order-service"}' \
  --data-urlencode 'limit=10' | jq .
```

---

### Vấn đề 3: Query trả về rỗng

**Nguyên nhân:**
- Label selector không match
- Time range quá ngắn
- Service chưa emit logs

**Giải pháp:**
```logql
# 1. Query đơn giản nhất - lấy tất cả logs
{}

# 2. Query chỉ một label
{service="order-service"}

# 3. Kiểm tra label values
# Trong Grafana > Explore > Loki
# Click "Label browser" để xem labels available
```

---

### Vấn đề 4: Variable $service không hoạt động

**Nguyên nhân:**
- Dashboard variable name không match
- Regex syntax sai
- Multi-value variable chưa config đúng

**Giải pháp:**

**Single value variable:**
```logql
{service="$service"}
```

**Multi-value variable (includeAll: true):**
```logql
{service=~"$service"}  # Chú ý: dùng =~ thay vì =
```

**Check trong Grafana:**
1. Click vào variable dropdown trên dashboard
2. Chọn một hoặc nhiều giá trị
3. Check query được generated (Inspect > Query)
4. Verify syntax: `{service=~"service1|service2"}`

---

### Vấn đề 5: Datasource UID không đúng

**Triệu chứng:**
- Variable không load được
- Panel không hiển thị data
- Error: "datasource not found"

**Fix:**
```bash
# 1. Lấy datasource UID từ Grafana API
curl -s "http://admin:admin@localhost:3000/api/datasources" | jq '.[] | {name, uid, type}'

# Output example:
# {
#   "name": "Loki",
#   "uid": "loki-datasource",
#   "type": "loki"
# }
```

**Update trong dashboard JSON:**
```json
{
  "datasource": {
    "type": "loki",
    "uid": "loki-datasource"  // ← Thay bằng UID thực tế
  }
}
```

---

## 📈 Mở rộng: Tạo Dashboard mới

### Bước 1: Tạo Dashboard cơ bản

1. **Grafana UI:**
   - Click ➕ > **Create Dashboard**
   - Click **Add visualization**
   - Chọn **Loki** datasource

2. **Thêm Variables:**
   - Settings > Variables > New variable
   - Tạo theo thứ tự: `service` → `level` → `method` → `status`

### Bước 2: Tạo Panels

**Panel 1: Recent Logs**
- Visualization: Logs
- Query: `{service=~"$service", level=~"$level"}`
- Options: Enable time, unique labels, wrap lines

**Panel 2: Error Rate**
- Visualization: Time series
- Query: `sum(rate({service=~"$service", level="error"}[1m])) by (service)`
- Legend: `{{service}} - Errors/sec`

**Panel 3: Status Code Distribution**
- Visualization: Pie chart
- Query: `sum by (status) (count_over_time({service=~"$service"}[1h]))`
- Legend: `{{status}}`

**Panel 4: Top Errors**
- Visualization: Table
- Query: 
  ```logql
  topk(10, 
    sum by (message) (
      count_over_time({service=~"$service", level="error"} | json [24h])
    )
  )
  ```

**Panel 5: Request Methods**
- Visualization: Bar gauge
- Query: `sum by (method) (count_over_time({service=~"$service"}[1h]))`
- Orientation: Horizontal

### Bước 3: Layout

```
┌─────────────────────────────────────────────────┐
│ Variables: [Service] [Level] [Method] [Status] │
├────────────────────┬────────────────────────────┤
│                    │                            │
│  Error Rate        │  Status Distribution       │
│  (Time Series)     │  (Pie Chart)               │
│                    │                            │
├────────────────────┴────────────────────────────┤
│                                                  │
│  Recent Logs (Logs panel)                       │
│                                                  │
├──────────────────────────────────────────────────┤
│  Top Errors (Table)                             │
└──────────────────────────────────────────────────┘
```

---

## 🚀 Advanced Queries

### 1. Calculate Percentiles
```logql
quantile_over_time(0.95,
  {service="api-gateway"} 
    | json 
    | unwrap responseTime [5m]
) by (path)
```

### 2. Pattern Detection
```logql
{service="user-service"} 
  |= "login" 
  | pattern `<_> user=<user> ip=<ip> status=<status>` 
  | status = "failed"
```

### 3. Multi-line Logs
```logql
{service="order-service"} 
  |= "Exception" 
  | pattern `<timestamp> <level> <_> - <message>` 
  | line_format "{{.timestamp}}: {{.message}}"
```

### 4. Rate by Label
```logql
sum by (status) (
  rate({service="payment-service"}[5m])
)
```

### 5. Bytes over time
```logql
sum(
  bytes_over_time({service="api-gateway"}[1h])
)
```

---

## 📝 Template Dashboard JSON

Sau khi config xong, export dashboard:
1. Dashboard Settings > JSON Model
2. Copy JSON
3. Hoặc: Share > Export > Save to file

Để import:
1. ➕ > Import dashboard
2. Upload JSON file hoặc paste JSON
3. Select datasource
4. Click Import

---

## 🎓 Tài liệu tham khảo

- [Grafana Variables Documentation](https://grafana.com/docs/grafana/latest/dashboards/variables/)
- [LogQL Syntax](https://grafana.com/docs/loki/latest/logql/)
- [Promtail Configuration](https://grafana.com/docs/loki/latest/clients/promtail/configuration/)
- [Loki Best Practices](https://grafana.com/docs/loki/latest/best-practices/)

---

## 📞 Support

Nếu gặp vấn đề:
1. Check Promtail logs: `docker logs promtail`
2. Check Loki logs: `docker logs loki`
3. Test API trực tiếp: `curl http://localhost:3100/ready`
4. Verify labels: `curl http://localhost:3100/loki/api/v1/labels`

---

**Lưu ý cuối cùng:**
- Luôn test query trong Grafana Explore trước khi thêm vào dashboard
- Sử dụng label cardinality thấp để tránh performance issues
- Monitor Loki memory usage khi scale up
- Backup dashboard JSON thường xuyên

Good luck! 🎉

