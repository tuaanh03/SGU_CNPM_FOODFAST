# 📊 BÁO CÁO REVIEW MONITORING PROJECT

**Ngày review:** November 15, 2025  
**Project:** Payment Processing Microservices - Food Delivery System

---

## 1. ✅ CÁC CẢI TIẾN ĐÃ THỰC HIỆN

### 1.1 HTTP Request Rate Panel - Đã thêm Thresholds và Status Colors

**Trước đây:**
- ❌ Không có thresholds cảnh báo
- ❌ Tất cả status codes cùng màu
- ❌ Không có mốc OK/Pending/Alert

**Sau khi cải tiến:**
- ✅ **Thresholds theo Request Rate:**
  - 🟢 Green (0-10 req/s): **OK** - Hệ thống hoạt động bình thường
  - 🟡 Yellow (10-50 req/s): **PENDING** - Tải tăng, cần theo dõi
  - 🟠 Orange (50-100 req/s): **WARNING** - Tải cao, cảnh báo
  - 🔴 Red (>100 req/s): **ALERT** - Tải quá cao, cần xử lý ngay

- ✅ **Color overrides theo Status Code:**
  - 🟢 2xx (200, 201, etc.): Green - Success
  - 🔵 3xx (301, 302, etc.): Blue - Redirect
  - 🟡 4xx (400, 401, 404, etc.): Yellow - Client Error
  - 🔴 5xx (500, 502, 503, etc.): Red - Server Error (line width tăng để dễ nhận diện)

- ✅ **Metrics tính toán:**
  - Mean (trung bình)
  - Max (giá trị cao nhất)
  - Last (giá trị hiện tại)

**Query được cải tiến:**
```promql
sum(rate({__name__=~".*_http_requests_total", instance="$instance"}[1m])) by (method, route, status_code)
```

### 1.2 Kafka Metrics Panels - MỚI THÊM

Đã thêm **5 panels mới** cho Kafka monitoring:

#### Panel 1: 📤 Kafka Producer Messages
- **Mục đích:** Theo dõi số lượng messages được publish
- **Metrics:** Success vs Error messages
- **Colors:** Green (success) / Red (error)
- **Query:**
  ```promql
  sum(rate({__name__=~".*_kafka_producer_messages_total", instance="$instance"}[1m])) by (topic, status)
  ```

#### Panel 2: 📥 Kafka Consumer Messages
- **Mục đích:** Theo dõi số lượng messages được consume
- **Metrics:** Success vs Error messages
- **Colors:** Green (success) / Red (error)
- **Query:**
  ```promql
  sum(rate({__name__=~".*_kafka_consumer_messages_total", instance="$instance"}[1m])) by (topic, status)
  ```

#### Panel 3: ⚡ Kafka Producer Latency (P95)
- **Mục đích:** Đo latency khi publish messages
- **Type:** Bar Gauge với thresholds
- **Thresholds:**
  - 🟢 < 50ms: Tốt
  - 🟡 50-100ms: Chấp nhận được
  - 🟠 100-500ms: Cảnh báo
  - 🔴 > 500ms: Nguy hiểm
- **Query:**
  ```promql
  histogram_quantile(0.95, sum(rate({__name__=~".*_kafka_producer_latency_seconds_bucket", instance="$instance"}[5m])) by (topic, le))
  ```

#### Panel 4: ⏱️ Kafka Consumer Processing Duration (P95)
- **Mục đích:** Đo thời gian xử lý messages
- **Type:** Bar Gauge với thresholds
- **Thresholds:**
  - 🟢 < 500ms: Tốt
  - 🟡 0.5-1s: Chấp nhận được
  - 🟠 1-5s: Cảnh báo
  - 🔴 > 5s: Nguy hiểm
- **Query:**
  ```promql
  histogram_quantile(0.95, sum(rate({__name__=~".*_kafka_consumer_processing_duration_seconds_bucket", instance="$instance"}[5m])) by (topic, le))
  ```

#### Panel 5: ❌ Kafka Errors
- **Mục đích:** Tổng hợp tất cả lỗi Kafka
- **Bao gồm:** Producer errors + Consumer errors
- **Thresholds:**
  - 🟡 > 0.01 err/s: Warning
  - 🔴 > 0.1 err/s: Alert
- **Query:**
  ```promql
  # Producer errors
  sum(rate({__name__=~".*_kafka_producer_errors_total", instance="$instance"}[1m])) by (topic, error_type)
  
  # Consumer errors
  sum(rate({__name__=~".*_kafka_consumer_errors_total", instance="$instance"}[1m])) by (topic, error_type)
  ```

---

## 2. 🔍 VẤN ĐỀ: TẠI SAO CHƯA CÓ DATA CHO KAFKA?

### Nguyên nhân phân tích:

1. **Services chưa được rebuild**
   - Các file `kafkaMetrics.ts` mới được tạo
   - Code TypeScript chưa được compile thành JavaScript
   - Cần rebuild Docker images

2. **Services chưa restart với code mới**
   - Containers đang chạy code cũ (không có Kafka metrics)
   - Cần restart để load code mới

3. **Chưa có traffic Kafka**
   - Metrics chỉ có giá trị khi có messages được publish/consume
   - Cần tạo orders để test

4. **Query có thể chưa chính xác**
   - Metric names cần match với code
   - Cần sử dụng regex pattern phù hợp

### Giải pháp:

```bash
# Bước 1: Rebuild services với code mới
cd /Users/anhngo/Downloads/Developer/NAM4/CNPM/Project/payment-processing-microservices-main
docker-compose up -d --build order-service payment-service product-service notification-service restaurant-service

# Bước 2: Restart Prometheus để reload config
docker-compose restart prometheus

# Bước 3: Kiểm tra metrics endpoints
curl http://localhost:2000/actuator/prometheus | grep kafka
curl http://localhost:4000/actuator/prometheus | grep kafka

# Bước 4: Tạo traffic để test
# Tạo orders thông qua API gateway

# Bước 5: Kiểm tra trong Prometheus
# http://localhost:9090/graph
# Query: order_service_kafka_producer_messages_total
```

---

## 3. 📊 CẤU TRÚC MONITORING HIỆN TẠI

### 3.1 Infrastructure

```
┌─────────────────────────────────────────────────────┐
│                  MONITORING STACK                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐      ┌──────────────┐            │
│  │  Prometheus  │◄─────┤   Services   │            │
│  │   :9090      │      │   (metrics)  │            │
│  └──────┬───────┘      └──────────────┘            │
│         │                                            │
│         │              ┌──────────────┐            │
│         └─────────────►│   Grafana    │            │
│                        │    :3001     │            │
│                        └──────────────┘            │
│                                                       │
│  ┌──────────────┐      ┌──────────────┐            │
│  │Kafka Exporter│      │Redis Exporter│            │
│  │   :9308      │      │    :9121     │            │
│  └──────────────┘      └──────────────┘            │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 3.2 Services được Monitor

| Service | Port | HTTP Metrics | Kafka Metrics | Status |
|---------|------|--------------|---------------|--------|
| user-service | 1000 | ✅ | ❌ | ✅ UP |
| order-service | 2000 | ✅ | ✅ | ✅ UP |
| product-service | 3004 | ✅ | ✅ | ✅ UP |
| restaurant-service | 3005 | ✅ | ✅ | ✅ UP |
| cart-service | 3006 | ✅ | ❌ | ✅ UP |
| payment-service | 4000 | ✅ | ✅ | ✅ UP |
| notification-service | 5000 | ✅ | ✅ | ✅ UP |

**Lưu ý:**
- user-service và cart-service không sử dụng Kafka nên không có Kafka metrics
- Tất cả services đều có HTTP metrics và default Node.js metrics

### 3.3 Grafana Dashboards

| Dashboard | Mục đích | Status | Panels |
|-----------|----------|--------|--------|
| **Microservices Overview** | Tổng quan services | ✅ **Đã cập nhật** | 15 panels (bao gồm Kafka) |
| Kafka Application Metrics | Chi tiết Kafka app-level | ✅ Sẵn sàng | 6 panels |
| Kafka Overview | Kafka broker-level | ✅ Sẵn sàng | 4 panels |
| Kafka Topics | Chi tiết topics | ✅ Sẵn sàng | - |
| Kafka Connect | Kafka Connect metrics | ✅ Sẵn sàng | - |

---

## 4. 📈 METRICS ĐƯỢC THU THẬP

### 4.1 HTTP Metrics (Tất cả services)

```typescript
// Từ lib/metrics.ts
- {service}_http_requests_total         // Counter: Tổng requests
- {service}_http_request_duration_seconds  // Histogram: Latency
- {service}_orders_total                 // Counter: Tổng orders (order-service)
- {service}_processing_duration_seconds  // Histogram: Processing time
```

### 4.2 Kafka Metrics (Services có Kafka)

```typescript
// Từ lib/kafkaMetrics.ts
PRODUCER:
- {service}_kafka_producer_messages_total        // Counter by (topic, status)
- {service}_kafka_producer_latency_seconds      // Histogram by (topic)
- {service}_kafka_producer_errors_total         // Counter by (topic, error_type)

CONSUMER:
- {service}_kafka_consumer_messages_total                    // Counter by (topic, status)
- {service}_kafka_consumer_processing_duration_seconds      // Histogram by (topic)
- {service}_kafka_consumer_errors_total                     // Counter by (topic, error_type)
```

### 4.3 Default Node.js Metrics

```
- process_cpu_seconds_total
- process_resident_memory_bytes
- process_heap_bytes
- nodejs_eventloop_lag_seconds
- nodejs_active_handles_total
- nodejs_active_requests_total
```

### 4.4 Kafka Broker Metrics (từ kafka-exporter)

```
- kafka_topic_partition_current_offset
- kafka_consumergroup_lag
- kafka_topic_partition_under_replicated_partition
- up{job="kafka-exporter"}
```

---

## 5. 🎯 QUERIES CHÍNH XÁC ĐỂ CÀO DỮ LIỆU

### 5.1 HTTP Metrics

```promql
# Request rate by status code
sum(rate({__name__=~".*_http_requests_total", instance="$instance"}[1m])) by (method, route, status_code)

# Errors only (4xx + 5xx)
sum(rate({__name__=~".*_http_requests_total", status_code=~"[45]..", instance="$instance"}[1m])) by (status_code)

# Request duration P95
histogram_quantile(0.95, sum(rate({__name__=~".*_http_request_duration_seconds_bucket", instance="$instance"}[5m])) by (route, le))
```

### 5.2 Kafka Producer Metrics

```promql
# Message rate
sum(rate({__name__=~".*_kafka_producer_messages_total", instance="$instance"}[1m])) by (topic, status)

# Success only
sum(rate({__name__=~".*_kafka_producer_messages_total", status="success", instance="$instance"}[1m])) by (topic)

# Latency P95
histogram_quantile(0.95, sum(rate({__name__=~".*_kafka_producer_latency_seconds_bucket", instance="$instance"}[5m])) by (topic, le))

# Error rate
sum(rate({__name__=~".*_kafka_producer_errors_total", instance="$instance"}[1m])) by (topic, error_type)
```

### 5.3 Kafka Consumer Metrics

```promql
# Consumption rate
sum(rate({__name__=~".*_kafka_consumer_messages_total", instance="$instance"}[1m])) by (topic, status)

# Processing duration P95
histogram_quantile(0.95, sum(rate({__name__=~".*_kafka_consumer_processing_duration_seconds_bucket", instance="$instance"}[5m])) by (topic, le))

# Error rate
sum(rate({__name__=~".*_kafka_consumer_errors_total", instance="$instance"}[1m])) by (topic, error_type)
```

### 5.4 System Metrics

```promql
# CPU usage
rate({__name__=~".*_process_cpu_seconds_total", instance="$instance"}[1m])

# Memory usage
{__name__=~".*_process_resident_memory_bytes", instance="$instance"}

# Event loop lag
{__name__=~".*_nodejs_eventloop_lag_seconds", instance="$instance"}
```

---

## 6. ✅ CHECKLIST HOÀN THÀNH

### Đã làm xong:
- [x] Tạo kafkaMetrics.ts cho tất cả services
- [x] Tích hợp metrics vào Kafka producer/consumer code
- [x] Cập nhật prometheus.yml (enable tất cả services)
- [x] Thêm thresholds cho HTTP Request Rate panel
- [x] Thêm color overrides theo status code
- [x] Thêm 5 Kafka metrics panels vào dashboard
- [x] Tạo dashboard riêng cho Kafka (kafka-app-metrics.json)
- [x] Viết documentation chi tiết
- [x] Tạo script kiểm tra (check-kafka-metrics.sh)

### Cần làm tiếp:
- [ ] **Build lại services để compile code mới**
- [ ] **Restart services để load code**
- [ ] **Test bằng cách tạo orders**
- [ ] **Verify metrics trong Prometheus**
- [ ] **Verify dashboards trong Grafana**

---

## 7. 🚀 HƯỚNG DẪN DEPLOY

```bash
# 1. Di chuyển vào thư mục project
cd /Users/anhngo/Downloads/Developer/NAM4/CNPM/Project/payment-processing-microservices-main

# 2. Build lại tất cả services với code mới
docker-compose up -d --build

# ⚠️ Nếu muốn build nhanh hơn (chỉ backend services):
docker-compose up -d --build order-service payment-service product-service notification-service restaurant-service prometheus

# 3. Đợi services khởi động (khoảng 2-3 phút)
docker-compose ps

# 4. Kiểm tra logs
docker logs order-service -f | grep kafka
docker logs payment-service -f | grep kafka

# 5. Test metrics endpoint
curl http://localhost:2000/actuator/prometheus | grep kafka

# 6. Tạo traffic để test
# Tạo order thông qua API hoặc frontend

# 7. Kiểm tra Prometheus
# Mở browser: http://localhost:9090
# Query: order_service_kafka_producer_messages_total

# 8. Kiểm tra Grafana
# Mở browser: http://localhost:3001 (admin/admin)
# Dashboard: Microservices Overview Dashboard
```

---

## 8. 📝 KẾT LUẬN

### Điểm mạnh của monitoring hiện tại:

✅ **Hoàn thiện:**
- Infrastructure đầy đủ (Prometheus, Grafana, Exporters)
- Dashboards đa dạng (HTTP, Kafka, System)
- Metrics chi tiết cho cả application và infrastructure level
- Thresholds và alerts rõ ràng

✅ **Dễ sử dụng:**
- Color coding rõ ràng (status codes, thresholds)
- Mô tả chi tiết trong panels
- Variable để filter theo service

✅ **Scalable:**
- Dễ thêm services mới
- Pattern-based queries (không hardcode service names)

### Cần cải thiện:

⚠️ **Cần action ngay:**
1. Build lại services để Kafka metrics hoạt động
2. Test kỹ với real traffic
3. Fine-tune thresholds theo workload thực tế

⚠️ **Tính năng mở rộng:**
1. Alert rules trong Prometheus (Alertmanager)
2. Tracing với Jaeger/Zipkin
3. Log aggregation với ELK Stack

---

## 9. 📚 TÀI LIỆU THAM KHẢO

- `Docs/KAFKA_METRICS_GUIDE.md` - Hướng dẫn chi tiết Kafka metrics
- `Docs/KAFKA_INTEGRATION_SUMMARY.md` - Tổng kết tích hợp
- `Docs/KAFKA_METRICS_QUERIES.md` - Queries và troubleshooting
- `check-kafka-metrics.sh` - Script tự động kiểm tra

---

**🎉 Monitoring system đã sẵn sàng! Chỉ cần build lại services là có thể sử dụng đầy đủ.**

