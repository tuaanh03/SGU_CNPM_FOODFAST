# TỔNG QUAN TÍCH HỢP KAFKA METRICS VỚI PROMETHEUS

## 📊 Tổng Quan Project

### ✅ Những gì đã có sẵn:
1. **Infrastructure**
   - ✅ Prometheus container (port 9090)
   - ✅ Grafana container (port 3001)
   - ✅ Kafka-exporter (port 9308) - Thu thập metrics từ Kafka broker
   - ✅ Redis-exporter (port 9121) - Thu thập metrics từ Redis

2. **Services đã có Prometheus metrics**
   - ✅ user-service (port 1000)
   - ✅ order-service (port 2000)
   - ✅ product-service (port 3004)
   - ✅ restaurant-service (port 3005)
   - ✅ cart-service (port 3006)
   - ✅ payment-service (port 4000)
   - ✅ notification-service (port 5000)

3. **Grafana Dashboards**
   - ✅ kafka-overview.json
   - ✅ kafka-topics.json
   - ✅ kafka-connect.json
   - ✅ grafana-microservices-dashboard.json

### ✅ Những gì vừa được tích hợp:

#### 1. **Kafka Metrics cho mỗi service**

Đã tạo file `kafkaMetrics.ts` cho các services:
- `/backend/services/order-service/src/lib/kafkaMetrics.ts`
- `/backend/services/payment-service/src/lib/kafkaMetrics.ts`
- `/backend/services/product-service/src/lib/kafkaMetrics.ts`
- `/backend/services/notification-service/src/lib/kafkaMetrics.ts`
- `/backend/services/restaurant-service/src/lib/kafkaMetrics.ts`

#### 2. **Metrics được thu thập**

**Producer Metrics:**
- `{service}_kafka_producer_messages_total` - Tổng số messages đã gửi (success/error)
- `{service}_kafka_producer_latency_seconds` - Latency khi publish message
- `{service}_kafka_producer_errors_total` - Tổng số lỗi producer

**Consumer Metrics:**
- `{service}_kafka_consumer_messages_total` - Tổng số messages đã nhận (success/error)
- `{service}_kafka_consumer_processing_duration_seconds` - Thời gian xử lý message
- `{service}_kafka_consumer_errors_total` - Tổng số lỗi consumer

#### 3. **Topics được theo dõi**

| Service | Producer Topics | Consumer Topics |
|---------|----------------|-----------------|
| **order-service** | `order.create`, `order.expired`, `order.retry.payment`, `order.confirmed` | `payment.event`, `inventory.reserve.result`, `product.sync` |
| **payment-service** | `payment.event` | `order.create`, `order.retry.payment`, `order.expired` |
| **product-service** | `product.sync`, `inventory.reserve.result` | `order.create`, `payment.event` |
| **notification-service** | - | `payment.event` |
| **restaurant-service** | - | `order.confirmed` |

---

## 🚀 Cách sử dụng

### 1. **Khởi động hệ thống**

```bash
# Build và start tất cả services
docker-compose up -d --build

# Hoặc chỉ restart services đã thay đổi
docker-compose restart order-service payment-service product-service notification-service restaurant-service
```

### 2. **Kiểm tra Prometheus**

Truy cập: http://localhost:9090

**Kiểm tra targets:**
- Vào `Status > Targets`
- Xác nhận tất cả services đều `UP`

**Query ví dụ:**

```promql
# Tổng số Kafka messages được publish bởi order-service
sum(rate(order_service_kafka_producer_messages_total[5m])) by (topic, status)

# Latency trung bình của Kafka producer
histogram_quantile(0.95, rate(order_service_kafka_producer_latency_seconds_bucket[5m]))

# Consumer lag theo topic
sum(order_service_kafka_consumer_processing_duration_seconds_sum) by (topic)

# Error rate của Kafka consumers
sum(rate(order_service_kafka_consumer_errors_total[5m])) by (topic, error_type)

# Messages từ Kafka exporter (broker-level metrics)
rate(kafka_topic_partition_current_offset[5m])

# Consumer group lag
kafka_consumergroup_lag{group="order-service-group"}
```

### 3. **Xem metrics trên Grafana**

Truy cập: http://localhost:3001
- Username: `admin`
- Password: `admin`

**Import dashboards:**
1. Vào `Dashboards > Browse`
2. Các dashboard đã được tự động import:
   - Kafka - Overview
   - Kafka Topics
   - Kafka Connect
   - Grafana Microservices Dashboard

**Tạo dashboard mới cho Application-level Kafka Metrics:**

```json
{
  "title": "Kafka Application Metrics",
  "panels": [
    {
      "title": "Producer Message Rate by Service",
      "targets": [{
        "expr": "sum(rate(order_service_kafka_producer_messages_total{status='success'}[5m])) by (topic)"
      }]
    },
    {
      "title": "Consumer Processing Duration (95th percentile)",
      "targets": [{
        "expr": "histogram_quantile(0.95, rate(order_service_kafka_consumer_processing_duration_seconds_bucket[5m])) by (topic)"
      }]
    },
    {
      "title": "Kafka Errors by Service",
      "targets": [{
        "expr": "sum(rate(order_service_kafka_producer_errors_total[5m])) by (topic, error_type)"
      }]
    }
  ]
}
```

---

## 📁 Cấu trúc File Review

### ✅ Files cần thiết:

**Docker & Infrastructure:**
- ✅ `docker-compose.yml` - Cấu hình đầy đủ, tốt
- ✅ `prometheus.yml` - Đã có kafka-exporter và redis-exporter
- ✅ `grafana-datasource.yml` - Cấu hình datasource Prometheus
- ✅ `grafana-dashboard-provider.yml` - Auto-provision dashboards

**Grafana Dashboards:**
- ✅ `grafana/dashboards/kafka-overview.json` - Overview Kafka cluster
- ✅ `grafana/dashboards/kafka-topics.json` - Topic metrics
- ✅ `grafana/dashboards/kafka-connect.json` - Kafka Connect metrics
- ✅ `grafana/dashboards/grafana-microservices-dashboard.json` - Services overview

**Backend Services:**
- ✅ Mỗi service đã có `src/lib/metrics.ts` - HTTP metrics
- ✅ Mỗi service đã có `src/lib/kafkaMetrics.ts` - Kafka metrics (VỪA TẠO)
- ✅ Mỗi service expose endpoint `/actuator/prometheus`

### ⚠️ Files có thể cân nhắc:

**Documentation:**
- ✅ `Docs/KAFKA_METRICS_GUIDE.md` - File này
- ❓ Các file docs khác có thể gộp lại để tránh duplicate

**Frontend:**
- ✅ 3 frontend apps (cnpm-fooddelivery, restaurant-merchant, admin-dashboard) - Cấu trúc hợp lý

### ❌ Vấn đề cần lưu ý:

1. **Cấu hình Prometheus chưa đầy đủ:**
   - ⚠️ Một số services đang bị comment trong `prometheus.yml`:
     ```yaml
     #  - job_name: 'notification-service'
     #  - job_name: 'payment-service'
     #  - job_name: 'restaurant-service'
     ```
   - ✅ **Đã fix:** Cần uncomment hoặc sử dụng container names

2. **Environment Variables:**
   - ⚠️ Cần đảm bảo tất cả `.env` files đã được tạo cho mỗi service

---

## 🔧 Troubleshooting

### 1. Không thấy metrics trong Prometheus

**Kiểm tra:**
```bash
# Xem logs của service
docker logs order-service

# Kiểm tra metrics endpoint
curl http://localhost:2000/actuator/prometheus | grep kafka

# Restart service
docker-compose restart order-service
```

### 2. Grafana không kết nối Prometheus

**Fix:**
```bash
# Kiểm tra Prometheus đang chạy
docker ps | grep prometheus

# Kiểm tra datasource trong Grafana
# URL phải là: http://prometheus:9090
```

### 3. Kafka exporter không có data

**Kiểm tra:**
```bash
# Test Kafka exporter endpoint
curl http://localhost:9308/metrics

# Xem logs
docker logs kafka-exporter

# Restart
docker-compose restart kafka-exporter
```

---

## 📈 Queries Prometheus Hữu Ích

### Application-level Kafka Metrics

```promql
# 1. Message throughput per service
sum(rate(order_service_kafka_producer_messages_total[5m])) by (topic, status)
sum(rate(payment_service_kafka_producer_messages_total[5m])) by (topic, status)
sum(rate(product_service_kafka_producer_messages_total[5m])) by (topic, status)

# 2. Consumer lag (processing time)
histogram_quantile(0.95, 
  sum(rate(order_service_kafka_consumer_processing_duration_seconds_bucket[5m])) by (topic, le)
)

# 3. Error rates
sum(rate(order_service_kafka_consumer_errors_total[5m])) by (topic, error_type)
sum(rate(payment_service_kafka_producer_errors_total[5m])) by (topic, error_type)

# 4. Producer latency (p95)
histogram_quantile(0.95,
  sum(rate(order_service_kafka_producer_latency_seconds_bucket[5m])) by (topic, le)
)
```

### Broker-level Kafka Metrics (từ kafka-exporter)

```promql
# 1. Topic message in rate
rate(kafka_topic_partition_current_offset[5m])

# 2. Consumer group lag
kafka_consumergroup_lag

# 3. Under-replicated partitions
kafka_topic_partition_under_replicated_partition

# 4. Broker status
up{job="kafka-exporter"}
```

---

## ✅ Kết luận

### Đã hoàn thành:
1. ✅ Tích hợp Kafka metrics vào tất cả services sử dụng Kafka
2. ✅ Tạo kafkaMetrics.ts cho từng service
3. ✅ Track producer và consumer metrics chi tiết
4. ✅ Tích hợp với Prometheus metrics hiện có
5. ✅ Sử dụng kafka-exporter cho broker-level metrics

### Cấu trúc project:
- ✅ **Tốt:** Tách biệt services, có docker-compose đầy đủ
- ✅ **Tốt:** Đã có monitoring stack (Prometheus + Grafana)
- ✅ **Tốt:** Kafka exporter và Redis exporter đã được setup
- ⚠️ **Cần cải thiện:** Uncomment các services trong prometheus.yml
- ⚠️ **Cần cải thiện:** Tạo dashboard tổng hợp cho application-level Kafka metrics

### Next Steps:
1. Test toàn bộ flow để đảm bảo metrics được thu thập đúng
2. Tạo alerts trong Prometheus cho Kafka errors
3. Tạo comprehensive Grafana dashboard cho Kafka application metrics
4. Document các best practices cho team

