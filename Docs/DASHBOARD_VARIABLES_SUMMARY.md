# 📊 Tổng kết: Dashboard Variables và Loki Labels

## ✅ Đã hoàn thành

### 1. Phân tích vấn đề
- ✅ Xác định được dashboard dùng biến `instance` cho Prometheus
- ✅ Xác định được Loki có label `service` nhưng không có `instance`
- ✅ Xác định được labels `level`, `method`, `status` chưa tồn tại trong Loki (cần JSON logging)

### 2. Sửa Dashboard
- ✅ Giữ nguyên biến `instance` (Prometheus) - cho metrics panels
- ✅ Thêm biến `service` (Loki) - cho logs panels
- ✅ Thêm biến `search_text` (textbox) - để tìm kiếm text trong logs
- ✅ Loại bỏ các biến không hoạt động (`level`, `method`, `status`)

### 3. Tạo tài liệu hướng dẫn
- ✅ **GRAFANA_LOKI_QUERY_GUIDE.md** - Hướng dẫn chi tiết query LogQL và mở rộng
- ✅ **DASHBOARD_VARIABLES_SOLUTION.md** - Giải pháp đồng bộ variables
- ✅ **LOKI_LABELS_ISSUE_FIX.md** - Giải thích vấn đề labels và cách fix

---

## 📋 Dashboard Variables hiện tại

| Variable | Type | Datasource | Purpose | Status |
|----------|------|------------|---------|--------|
| `instance` | Query | Prometheus | Filter metrics by instance (host:port) | ✅ Hoạt động |
| `service` | Query | Loki | Filter logs by service name | ✅ Hoạt động |
| `search_text` | Textbox | N/A | Search text in logs | ✅ Hoạt động |

---

## 🎯 Cách sử dụng Dashboard

### Filter Metrics (Prometheus panels)
1. **Chọn Instance**: Chọn instance từ dropdown (ví dụ: `api-gateway:3000`)
2. **Panels sẽ hiển thị**:
   - HTTP Request Rate
   - Memory Usage  
   - CPU Usage
   - HTTP Errors
   - Service Health
   - Service Uptime
   - Heap Memory
   - Event Loop Lag
   - Active Handles & Requests

**Query example:**
```promql
rate(http_requests_total{instance="$instance"}[1m])
up{instance="$instance"}
```

---

### Filter Logs (Loki panels)
1. **Chọn Service**: Chọn một hoặc nhiều services (hoặc "All")
2. **Nhập Search Text**: Nhập keyword để tìm trong logs (optional)
3. **Panels sẽ hiển thị**: Logs matching service và search text

**Query example:**
```logql
# Chỉ filter service
{service=~"$service"}

# Filter service + search text
{service=~"$service"} |= "$search_text"

# Ví dụ cụ thể:
{service="order-service"} |= "error"
{service=~"user-service|order-service"} |= "POST"
{service=~".*"} |= "payment failed"
```

---

## 🔍 Labels có sẵn trong Loki

### Stream Labels (Indexed - Filter nhanh):
```
service           - Tên service (user-service, order-service, etc.)
container_name    - Tên Docker container
container_id      - ID Docker container
job               - Nguồn log (docker, node-app-logs)
stream            - stdout hoặc stderr
project           - Docker compose project name
filename          - File path
```

### Parsed Fields (Not indexed - Cần parse JSON):
```
timestamp         - Timestamp của log
level             - Log level (nếu có trong JSON)
method            - HTTP method (nếu có trong JSON)
path              - URL path (nếu có trong JSON)
status            - HTTP status code (nếu có trong JSON)
responseTime      - Response time (nếu có trong JSON)
... (tùy JSON structure)
```

---

## 📊 Query Examples

### 1. Xem tất cả logs của một service
```logql
{service="order-service"}
```

### 2. Tìm errors trong logs
```logql
{service="order-service"} |= "error"
{service="order-service"} |= "ERROR"
{service=~".*"} |= "error" |= "payment"
```

### 3. Tìm HTTP status codes
```logql
{service="api-gateway"} |= "500"
{service="api-gateway"} |~ "50[0-9]"  # Regex
{service="payment-service"} |= "4" |= "POST"
```

### 4. Tìm trong nhiều services
```logql
{service=~"order-service|payment-service"} |= "failed"
{service=~".*-service"} |= "timeout"
```

### 5. Dùng variables
```logql
{service=~"$service"}
{service=~"$service"} |= "$search_text"
```

### 6. Nếu logs là JSON (sau khi implement JSON logging)
```logql
# Parse JSON
{service="order-service"} | json

# Filter by parsed field
{service="order-service"} | json | level="error"
{service="order-service"} | json | status >= 400

# Format output
{service="order-service"} 
  | json 
  | line_format "{{.timestamp}} [{{.level}}] {{.method}} {{.path}} - {{.status}}"
```

---

## 🚀 Roadmap nâng cấp

### Phase 1: Immediate (Đã hoàn thành) ✅
- [x] Fix dashboard variables
- [x] Tạo tài liệu hướng dẫn
- [x] Test labels trong Loki
- [x] Document vấn đề và giải pháp

### Phase 2: Short-term (1-2 tuần)
- [ ] Implement JSON logging cho User Service
- [ ] Implement JSON logging cho Order Service
- [ ] Implement JSON logging cho Payment Service
- [ ] Implement JSON logging cho Restaurant Service
- [ ] Test labels `level`, `method`, `status` xuất hiện trong Loki
- [ ] Re-add variables `level`, `method`, `status` vào dashboard

### Phase 3: Long-term (1-2 tháng)
- [ ] Standardize logging format cho tất cả services
- [ ] Add structured logging library (Pino/Winston)
- [ ] Add trace ID correlation
- [ ] Add user ID trong logs (nếu authenticated)
- [ ] Setup log retention policy
- [ ] Add alerting rules cho critical errors
- [ ] Create dedicated logs dashboard (separate from metrics)

---

## 📚 Tài liệu tham khảo

### Đã tạo:
1. **`Docs/GRAFANA_LOKI_QUERY_GUIDE.md`**
   - Hướng dẫn chi tiết LogQL syntax
   - Cách tạo variables
   - Query examples nâng cao
   - Troubleshooting guide
   - Best practices

2. **`Docs/DASHBOARD_VARIABLES_SOLUTION.md`**
   - Giải pháp đồng bộ Prometheus vs Loki
   - Cấu hình variables
   - Workflow sử dụng
   - Test guide

3. **`Docs/LOKI_LABELS_ISSUE_FIX.md`**
   - Vấn đề labels không xuất hiện
   - 3 giải pháp (text search / JSON logging / regex parse)
   - Code examples
   - Action plan

### External:
- [Grafana Variables Documentation](https://grafana.com/docs/grafana/latest/dashboards/variables/)
- [LogQL Documentation](https://grafana.com/docs/loki/latest/logql/)
- [Promtail Configuration](https://grafana.com/docs/loki/latest/clients/promtail/configuration/)
- [Morgan JSON Format](https://github.com/expressjs/morgan)

---

## 🧪 Testing Checklist

### Test Dashboard Variables:
- [x] Variable `instance` hiển thị danh sách instances từ Prometheus
- [x] Variable `service` hiển thị danh sách services từ Loki
- [x] Variable `search_text` cho phép nhập text tự do
- [x] Khi chọn instance, metrics panels update
- [x] Khi chọn service, logs panels update (nếu có logs panel)

### Test Loki Labels:
```bash
# 1. Check labels available
curl -s "http://localhost:3100/loki/api/v1/labels" | jq .
# Expected: service, container_name, job, stream, etc.

# 2. Check service values
curl -s "http://localhost:3100/loki/api/v1/label/service/values" | jq .
# Expected: user-service, order-service, payment-service, etc.

# 3. Query logs by service
curl -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={service="order-service"}' \
  --data-urlencode 'limit=10' \
  --data-urlencode 'start=1731700000000000000' \
  --data-urlencode 'end=9999999999000000000' | jq .

# 4. Test text search
curl -G "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={service="order-service"} |= "POST"' \
  --data-urlencode 'limit=10' | jq .
```

### Test Grafana Dashboard:
1. ✅ Mở Grafana: `http://localhost:3000`
2. ✅ Login: admin/admin
3. ✅ Vào dashboard: "Microservices Overview Dashboard"
4. ✅ Check variables ở trên cùng: Instance, Service, Search in Logs
5. ✅ Thử filter:
   - Select Instance: `order-service:3001`
   - Select Service: `order-service`
   - Search: `POST`
6. ✅ Verify metrics panels update theo instance
7. ✅ Verify logs panels filter theo service (nếu có)

---

## ⚠️ Known Issues

### Issue 1: Labels `level`, `method`, `status` không có
**Nguyên nhân:** Logs không ở dạng JSON, Promtail không parse được

**Workaround:** Dùng text search `|=` thay vì label filter

**Fix:** Implement JSON logging (xem `LOKI_LABELS_ISSUE_FIX.md`)

---

### Issue 2: Variable dropdown rỗng
**Nguyên nhân:** 
- Datasource UID không đúng
- Labels không tồn tại trong Loki
- Network issue

**Fix:**
```bash
# Check datasource UID
curl -s "http://admin:admin@localhost:3000/api/datasources" | jq '.[] | select(.type=="loki") | {name, uid}'

# Update dashboard JSON với UID đúng
"datasource": {
  "type": "loki",
  "uid": "<correct-uid-here>"
}
```

---

### Issue 3: Query quá chậm
**Nguyên nhân:**
- Time range quá rộng
- Không filter by label trước
- Parse JSON/regex trên quá nhiều logs

**Fix:**
- Thu hẹp time range
- Luôn filter by `service` trước
- Dùng label filter trước text search
- Order: `{service="x"}` → `|= "text"` → `| json`

---

## 💡 Tips & Tricks

### 1. Query performance
```logql
# ❌ Chậm (parse tất cả logs)
{} | json | service="order-service"

# ✅ Nhanh (filter by label trước)
{service="order-service"} | json
```

### 2. Multi-value variable
```logql
# Khi includeAll: true, PHẢI dùng =~ (regex match)
{service=~"$service"}

# KHÔNG dùng = (exact match)
{service="$service"}  # ❌ Sai khi chọn nhiều values
```

### 3. Combine filters
```logql
# Chain text filters
{service="order-service"} 
  |= "POST" 
  |= "payment" 
  != "health"

# Regex filter
{service="api-gateway"} |~ "50[0-9]|40[0-4]"
```

### 4. Empty search text
```logql
# Nếu search_text rỗng, query vẫn work
{service=~"$service"} |= "$search_text"

# Khi $search_text = "", LogQL vẫn ok: |= ""
# Nó sẽ match tất cả logs
```

---

## 🎉 Kết luận

### Đã giải quyết:
✅ Dashboard có 2 bộ variables riêng biệt cho Prometheus và Loki

✅ Không còn xung đột giữa `instance` (Prometheus) và `service` (Loki)

✅ User có thể filter logs theo service và search text

✅ Tài liệu đầy đủ cho việc mở rộng và maintain

### Cần làm tiếp (Optional):
🔲 Implement JSON logging để có labels `level`, `method`, `status`

🔲 Tạo dashboard riêng cho logs (tách khỏi metrics)

🔲 Add alerting rules cho errors

🔲 Setup log retention policy

---

**Hoàn thành bởi:** GitHub Copilot  
**Ngày:** 16/11/2025  
**Status:** ✅ RESOLVED

