# ⚠️ Vấn đề Labels trong Loki và Cách Khắc phục

## 📊 Tình trạng hiện tại

### Labels CÓ trong Loki (Stream Labels - Indexed):
```
✅ service           - Tên service (user-service, order-service, etc.)
✅ container_name    - Tên Docker container  
✅ container_id      - ID Docker container
✅ job               - Nguồn log (docker, node-app-logs)
✅ stream            - stdout/stderr
✅ project           - Docker compose project name
✅ filename          - File path
```

### Labels KHÔNG CÓ (Parsed Fields - Not Indexed):
```
❌ level             - Log level (info, error, warn, debug)
❌ method            - HTTP method (GET, POST, etc.)
❌ status            - HTTP status code (200, 404, 500, etc.)
```

---

## 🔍 Tại sao `level`, `method`, `status` không xuất hiện?

### Lý do 1: Format log không đúng JSON
Promtail cần logs có format JSON để parse được fields:

**❌ Logs dạng text (không parse được):**
```
2025-11-16T13:21:48Z INFO GET /api/users 200 15ms
```

**✅ Logs dạng JSON (parse được):**
```json
{"timestamp":"2025-11-16T13:21:48Z","level":"info","method":"GET","path":"/api/users","status":200,"responseTime":15}
```

### Lý do 2: Pipeline chưa đúng
Promtail config có pipeline parse JSON, nhưng nếu log không đúng format thì parse fail.

### Lý do 3: Labels stage không hoạt động
Ngay cả khi parse JSON thành công, nếu fields không tồn tại trong JSON thì labels sẽ trống.

---

## 🛠️ Kiểm tra Log Format của Services

### Bước 1: Xem logs thực tế
```bash
# Xem logs của user-service
docker logs user-service 2>&1 | tail -5

# Xem logs của order-service
docker logs order-service 2>&1 | tail -5
```

### Bước 2: Xác định format
**Nếu logs dạng:**
- Text (morgan 'combined', 'dev', etc.) → ❌ Không parse được
- JSON (morgan + custom JSON format) → ✅ Parse được

---

## ✅ Giải pháp

### Tùy chọn 1: Giữ nguyên - Chỉ dùng label `service`

**Dashboard variables:**
- ✅ `service` - Hoạt động (filter theo service)
- ❌ `level`, `method`, `status` - Không hoạt động (không có labels)

**Query logs:**
```logql
# Chỉ filter theo service
{service="order-service"}

# Tìm text "error" trong logs
{service="order-service"} |= "error"

# Tìm text "POST" và "500"
{service="order-service"} |= "POST" |= "500"
```

**Pros:**
- Không cần sửa code
- Đơn giản, dễ maintain

**Cons:**
- Không filter chính xác theo level/method/status
- Phải dùng text search `|=` (chậm hơn label filter)

---

### Tùy chọn 2: Thay đổi Log Format thành JSON

**Cần làm:**
1. Sửa logging middleware trong từng service
2. Output logs dạng JSON
3. Promtail sẽ tự động parse và tạo labels

#### Ví dụ: User Service

**File: `backend/services/user-service/src/index.ts` (hoặc `app.ts`)**

**❌ Hiện tại (morgan text format):**
```typescript
import morgan from 'morgan';

app.use(morgan('dev'));
```

**✅ Thay đổi (JSON format):**
```typescript
import morgan from 'morgan';

// Custom JSON format cho morgan
morgan.token('json-log', (req: any, res: any) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 400 ? 'error' : 'info',
    service: 'user-service',
    method: req.method,
    path: req.url,
    status: res.statusCode,
    responseTime: res.responseTime || 0,
    contentLength: res.get('content-length') || 0,
    userAgent: req.get('user-agent') || '',
    ip: req.ip || req.connection.remoteAddress
  });
});

app.use(morgan(':json-log'));
```

**Hoặc dùng thư viện winston/pino:**

```typescript
import pino from 'pino';

const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      timestamp: new Date().toISOString(),
      service: 'user-service',
      method: req.method,
      path: req.url,
      status: res.statusCode,
      responseTime: Date.now() - start,
      ip: req.ip
    });
  });
  next();
});
```

**Output log sẽ là:**
```json
{"timestamp":"2025-11-16T13:21:48.000Z","level":"info","service":"user-service","method":"GET","path":"/api/users","status":200,"responseTime":15}
```

---

### Tùy chọn 3: Parse text logs bằng Regex (Complex)

**Promtail config** (nếu logs là text format):

```yaml
pipeline_stages:
  # Parse text format với regex
  - regex:
      expression: '^(?P<timestamp>[\d-T:\.Z]+)\s+(?P<level>\w+)\s+(?P<method>\w+)\s+(?P<path>\S+)\s+(?P<status>\d+)\s+(?P<responseTime>\d+)ms'
  
  # Convert fields to labels
  - labels:
      level:
      method:
      status:
  
  # Parse timestamp
  - timestamp:
      source: timestamp
      format: RFC3339
```

**Pros:**
- Không cần sửa code service

**Cons:**
- Regex phức tạp, dễ sai
- Performance kém hơn JSON parse
- Khó maintain

---

## 🎯 Khuyến nghị: Giải pháp Hybrid

### Dashboard Variables Setup:

**Variable 1: `service` (Loki label - Hoạt động)**
```json
{
  "name": "service",
  "datasource": "loki",
  "query": {"label": "service"},
  "includeAll": true
}
```

**Variable 2: `search_text` (Text box - User nhập)**
```json
{
  "name": "search_text",
  "type": "textbox",
  "label": "Search",
  "default": ""
}
```

**Variable 3: `log_level_filter` (Custom - Dropdown)**
```json
{
  "name": "log_level_filter",
  "type": "custom",
  "label": "Log Level Filter",
  "query": "All,info,error,warn,debug",
  "includeAll": false,
  "default": "All"
}
```

### Query trong Panel:

```logql
# Filter by service và search text
{service=~"$service"} 
  |= "$search_text"
  ${ log_level_filter != "All" ? '|= "' + log_level_filter + '"' : '' }
```

**Hoặc dùng variable condition:**

```logql
{service=~"$service"} 
  ${search_text != "" ? '|= "' + search_text + '"' : ''}
  ${log_level_filter != "All" ? '|= "' + log_level_filter + '"' : ''}
```

---

## 📝 Hướng dẫn Update Dashboard

### Bước 1: Xóa variables không hoạt động

Vào Dashboard > Settings > Variables:
- Xóa `level` (Loki query - không có label)
- Xóa `method` (Loki query - không có label)
- Xóa `status` (Loki query - không có label)

### Bước 2: Thêm variables mới

**Variable: `search_text`**
- Type: **Text box**
- Name: `search_text`
- Label: `Search in logs`
- Default value: `` (empty)

**Variable: `log_level_filter`**
- Type: **Custom**
- Name: `log_level_filter`
- Label: `Log Level`
- Custom options: `All,info,error,warn,debug`
- Default: `All`

**Variable: `status_filter`**
- Type: **Custom**
- Name: `status_filter`
- Label: `Status Code`
- Custom options: `All,200,201,400,401,404,500,502,503`
- Default: `All`

### Bước 3: Update Logs Panel Query

```logql
{service=~"$service"} 
  |= "$search_text" 
  |~ "${log_level_filter == 'All' ? '.*' : log_level_filter}" 
  |~ "${status_filter == 'All' ? '.*' : status_filter}"
```

**Hoặc đơn giản hơn (dùng text search):**

```logql
{service=~"$service"} |= "$search_text"
```

---

## 🔧 Code Example: JSON Logging

### File: `backend/services/user-service/src/middlewares/logger.ts`

```typescript
import morgan from 'morgan';
import { Request, Response } from 'express';

// Custom JSON token
morgan.token('json', (req: Request, res: Response) => {
  const log = {
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 400 ? (res.statusCode >= 500 ? 'error' : 'warn') : 'info',
    service: process.env.SERVICE_NAME || 'user-service',
    method: req.method,
    path: req.originalUrl || req.url,
    status: res.statusCode,
    responseTime: res.get('X-Response-Time') || 0,
    contentLength: res.get('content-length') || 0,
    userAgent: req.get('user-agent') || '',
    ip: req.ip || req.socket.remoteAddress
  };
  return JSON.stringify(log);
});

export const httpLogger = morgan(':json', {
  stream: {
    write: (message: string) => {
      console.log(message.trim()); // Output to stdout
    }
  }
});
```

### File: `backend/services/user-service/src/index.ts`

```typescript
import express from 'express';
import { httpLogger } from './middlewares/logger';

const app = express();

// Use JSON logger
app.use(httpLogger);

// Routes...
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'user-service',
    message: 'Server started on port 3000'
  }));
});
```

---

## ✅ Kết quả sau khi apply JSON logging

### Loki Labels (Stream Labels):
```
✅ service
✅ level        ← MỚI
✅ method       ← MỚI
✅ status       ← MỚI
✅ container_name
✅ job
✅ stream
```

### Grafana Variables sẽ hoạt động:
```
✅ $service     - Filter by service name
✅ $level       - Filter by log level (info, error, warn, debug)
✅ $method      - Filter by HTTP method (GET, POST, PUT, DELETE)
✅ $status      - Filter by status code (200, 404, 500, etc.)
```

### Query logs:
```logql
# Chính xác với labels
{service="user-service", level="error", method="POST", status="500"}

# Hoặc với variables
{service=~"$service", level=~"$level", method=~"$method", status=~"$status"}
```

---

## 📊 So sánh giải pháp

| Giải pháp | Effort | Performance | Flexibility | Recommended |
|-----------|--------|-------------|-------------|-------------|
| **Tùy chọn 1: Text search only** | ⭐ Low | ⭐⭐ Medium | ⭐⭐ Medium | ✅ Quick fix |
| **Tùy chọn 2: JSON logging** | ⭐⭐⭐ High | ⭐⭐⭐ High | ⭐⭐⭐ High | ✅✅ Best long-term |
| **Tùy chọn 3: Regex parse** | ⭐⭐ Medium | ⭐ Low | ⭐⭐ Medium | ❌ Not recommended |

---

## 🚀 Action Plan

### Ngắn hạn (Immediate - 5 phút):
1. ✅ Xóa variables `level`, `method`, `status` khỏi dashboard (vì không hoạt động)
2. ✅ Thêm variable `search_text` (textbox) để user tìm kiếm text
3. ✅ Chỉ dùng `service` variable để filter
4. ✅ Update logs panels query: `{service=~"$service"} |= "$search_text"`

### Trung hạn (1-2 ngày):
1. Sửa logging middleware trong services sang JSON format
2. Test logs output format
3. Verify Promtail parse được labels
4. Re-add variables `level`, `method`, `status` khi labels đã có

### Dài hạn (Future):
1. Standardize logging across all services
2. Add structured logging library (pino/winston)
3. Add trace ID, user ID vào logs
4. Setup log retention policy trong Loki

---

## 🧪 Test Labels sau khi đổi JSON logging

```bash
# 1. Restart service sau khi sửa code
docker-compose restart user-service

# 2. Trigger một request
curl http://localhost:3000/api/users

# 3. Check logs
docker logs user-service --tail 1

# Expected output (JSON):
# {"timestamp":"2025-11-16T13:21:48.000Z","level":"info","service":"user-service","method":"GET","path":"/api/users","status":200}

# 4. Wait 5-10 giây cho Promtail gửi logs

# 5. Check labels trong Loki
curl -s "http://localhost:3100/loki/api/v1/labels" | jq -r '.data[]' | sort

# Expected: sẽ thấy thêm level, method, status

# 6. Check label values
curl -s "http://localhost:3100/loki/api/v1/label/level/values" | jq .
# Expected: {"status":"success","data":["info","error","warn","debug"]}

# 7. Query logs với label
curl -G "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={service="user-service", level="info"}' \
  --data-urlencode 'limit=5' | jq .
```

---

## 📚 Tài liệu tham khảo

- [Promtail Pipeline Stages](https://grafana.com/docs/loki/latest/clients/promtail/stages/)
- [Morgan JSON Tokens](https://github.com/expressjs/morgan#creating-new-tokens)
- [Pino Structured Logging](https://getpino.io/)
- [Loki Label Best Practices](https://grafana.com/docs/loki/latest/best-practices/)

---

**Tóm tắt:**
- ✅ Labels `service`, `container_name`, `job` đang hoạt động
- ❌ Labels `level`, `method`, `status` chưa hoạt động (cần JSON logging)
- 🎯 Giải pháp ngắn hạn: Dùng text search thay vì label filter
- 🚀 Giải pháp dài hạn: Chuyển sang JSON logging format

