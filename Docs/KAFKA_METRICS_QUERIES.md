# 🔍 HƯỚNG DẪN PROMETHEUS QUERIES CHO KAFKA METRICS

## ❗ VẤN ĐỀ: TẠI SAO CHƯA CÓ DATA CHO KAFKA?

### Nguyên nhân có thể:

1. **Services chưa được build lại** - Các file kafkaMetrics.ts mới tạo chưa được compile
2. **Services chưa restart** - Cần restart để load code mới
3. **Chưa có traffic Kafka** - Chưa có messages được publish/consume
4. **Query không chính xác** - Cần sử dụng đúng metric names

---

## ✅ CÁCH KIỂM TRA VÀ FIX

### Bước 1: Kiểm tra metrics endpoint của từng service

```bash
# Order Service
curl http://localhost:2000/actuator/prometheus | grep kafka

# Payment Service  
curl http://localhost:4000/actuator/prometheus | grep kafka

# Product Service
curl http://localhost:3004/actuator/prometheus | grep kafka

# Notification Service (nếu đã expose metrics endpoint)
curl http://localhost:5000/actuator/prometheus | grep kafka

# Restaurant Service
curl http://localhost:3005/actuator/prometheus | grep kafka
```

**Kết quả mong đợi:**
```
order_service_kafka_producer_messages_total{topic="order.create",status="success"} 10
order_service_kafka_consumer_messages_total{topic="payment.event",status="success"} 5
order_service_kafka_producer_latency_seconds_bucket{topic="order.create",le="0.001"} 8
...
```

### Bước 2: Nếu KHÔNG thấy metrics kafka, cần build lại

```bash
cd /Users/anhngo/Downloads/Developer/NAM4/CNPM/Project/payment-processing-microservices-main

# Rebuild và restart services
docker-compose up -d --build order-service payment-service product-service notification-service restaurant-service

# Hoặc restart nhanh hơn (nếu đã build)
docker-compose restart order-service payment-service product-service notification-service restaurant-service
```

### Bước 3: Kiểm tra Prometheus có scrape được không

Truy cập: http://localhost:9090/targets

Đảm bảo tất cả services đều:
- Status: **UP**
- Last Scrape: có timestamp gần đây

---

## 📊 PROMETHEUS QUERIES CHÍNH XÁC

### 1. Kafka Producer Metrics

#### Message Rate (messages/second)
```promql
# Tổng messages được publish theo topic và status
sum(rate(order_service_kafka_producer_messages_total[1m])) by (topic, status)

# Chỉ messages thành công
sum(rate(order_service_kafka_producer_messages_total{status="success"}[1m])) by (topic)

# Tất cả services
sum(rate({__name__=~".*_kafka_producer_messages_total", status="success"}[1m])) by (job, topic)
```

#### Producer Latency (P95)
```promql
# Latency percentile 95 của producer
histogram_quantile(0.95, 
  sum(rate(order_service_kafka_producer_latency_seconds_bucket[5m])) by (topic, le)
)

# Tất cả services
histogram_quantile(0.95,
  sum(rate({__name__=~".*_kafka_producer_latency_seconds_bucket"}[5m])) by (job, topic, le)
)
```

#### Producer Errors
```promql
# Error rate
sum(rate(order_service_kafka_producer_errors_total[1m])) by (topic, error_type)

# Tất cả services
sum(rate({__name__=~".*_kafka_producer_errors_total"}[1m])) by (job, topic, error_type)
```

### 2. Kafka Consumer Metrics

#### Message Consumption Rate
```promql
# Messages consumed per second
sum(rate(order_service_kafka_consumer_messages_total[1m])) by (topic, status)

# Chỉ messages thành công
sum(rate(order_service_kafka_consumer_messages_total{status="success"}[1m])) by (topic)

# Tất cả services
sum(rate({__name__=~".*_kafka_consumer_messages_total", status="success"}[1m])) by (job, topic)
```

#### Consumer Processing Duration (P95)
```promql
# Thời gian xử lý message percentile 95
histogram_quantile(0.95,
  sum(rate(order_service_kafka_consumer_processing_duration_seconds_bucket[5m])) by (topic, le)
)

# Tất cả services
histogram_quantile(0.95,
  sum(rate({__name__=~".*_kafka_consumer_processing_duration_seconds_bucket"}[5m])) by (job, topic, le)
)
```

#### Consumer Errors
```promql
# Error rate
sum(rate(order_service_kafka_consumer_errors_total[1m])) by (topic, error_type)

# Tất cả services
sum(rate({__name__=~".*_kafka_consumer_errors_total"}[1m])) by (job, topic, error_type)
```

### 3. Kafka Broker Metrics (từ kafka-exporter)

```promql
# Broker up/down status
up{job="kafka-exporter"}

# Message in rate per topic
rate(kafka_topic_partition_current_offset[5m])

# Consumer group lag
kafka_consumergroup_lag

# Under-replicated partitions
kafka_topic_partition_under_replicated_partition
```

---

## 🎯 QUERIES CHO DASHBOARD

### Panel: HTTP Request Rate với Thresholds

```promql
# Query đã được update trong dashboard
sum(rate({__name__=~".*_http_requests_total", instance="$instance"}[1m])) by (method, route, status_code)
```

**Thresholds:**
- 🟢 Green: 0-10 req/s (OK)
- 🟡 Yellow: 10-50 req/s (Pending)  
- 🟠 Orange: 50-100 req/s (Warning)
- 🔴 Red: > 100 req/s (Alert)

**Color overrides theo status code:**
- 2xx: Green (Success)
- 3xx: Blue (Redirect)
- 4xx: Yellow (Client Error)
- 5xx: Red (Server Error)

### Panel: Kafka Producer Messages

```promql
sum(rate({__name__=~".*_kafka_producer_messages_total", instance="$instance"}[1m])) by (topic, status)
```

### Panel: Kafka Consumer Messages

```promql
sum(rate({__name__=~".*_kafka_consumer_messages_total", instance="$instance"}[1m])) by (topic, status)
```

### Panel: Kafka Producer Latency (P95)

```promql
histogram_quantile(0.95, 
  sum(rate({__name__=~".*_kafka_producer_latency_seconds_bucket", instance="$instance"}[5m])) by (topic, le)
)
```

### Panel: Kafka Consumer Processing Duration (P95)

```promql
histogram_quantile(0.95,
  sum(rate({__name__=~".*_kafka_consumer_processing_duration_seconds_bucket", instance="$instance"}[5m])) by (topic, le)
)
```

### Panel: Kafka Errors

```promql
# Producer errors
sum(rate({__name__=~".*_kafka_producer_errors_total", instance="$instance"}[1m])) by (topic, error_type)

# Consumer errors
sum(rate({__name__=~".*_kafka_consumer_errors_total", instance="$instance"}[1m])) by (topic, error_type)
```

---

## 🧪 TESTING - Tạo traffic để test metrics

### 1. Test Producer Metrics

```bash
# Tạo một order để trigger Kafka producer
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "user123",
    "items": [
      {
        "productId": "prod123",
        "quantity": 2
      }
    ],
    "totalPrice": 100000
  }'
```

### 2. Kiểm tra metrics ngay sau đó

```bash
# Xem producer metrics
curl http://localhost:2000/actuator/prometheus | grep kafka_producer

# Xem consumer metrics từ payment service
curl http://localhost:4000/actuator/prometheus | grep kafka_consumer
```

### 3. Xem trong Prometheus

Truy cập: http://localhost:9090/graph

Query:
```promql
order_service_kafka_producer_messages_total
```

Nếu thấy data → ✅ Metrics đang hoạt động!

---

## 🔧 TROUBLESHOOTING

### Vấn đề 1: Không thấy metrics trong Prometheus

**Nguyên nhân:**
- Services chưa restart sau khi thêm kafkaMetrics.ts
- Prometheus chưa scrape được

**Giải pháp:**
```bash
# 1. Restart services
docker-compose restart order-service payment-service product-service

# 2. Kiểm tra Prometheus targets
# http://localhost:9090/targets

# 3. Force reload Prometheus config
docker-compose restart prometheus
```

### Vấn đề 2: Metrics có nhưng value = 0

**Nguyên nhân:**
- Chưa có traffic Kafka (chưa có messages được publish/consume)

**Giải pháp:**
- Tạo orders để trigger Kafka messages
- Đợi một chút để metrics được update

### Vấn đề 3: Query trả về "No data"

**Nguyên nhân:**
- Query sai syntax
- Metric name không đúng
- Time range quá ngắn

**Giải pháp:**
```promql
# Kiểm tra metrics có tồn tại không
{__name__=~".*kafka.*"}

# List tất cả kafka metrics
{__name__=~".*_kafka_producer_messages_total"}
{__name__=~".*_kafka_consumer_messages_total"}

# Thử query đơn giản nhất
order_service_kafka_producer_messages_total

# Nếu không có, kiểm tra tên chính xác
{__name__=~"order_service.*"}
```

### Vấn đề 4: Dashboard không hiển thị data

**Nguyên nhân:**
- Variable `$instance` không được set
- Datasource UID không đúng

**Giải pháp:**
1. Kiểm tra variable `instance` trong dashboard settings
2. Kiểm tra Prometheus datasource UID
3. Test query trực tiếp trong Prometheus trước

---

## 📋 CHECKLIST ĐỂ ĐẢM BẢO KAFKA METRICS HOẠT ĐỘNG

- [ ] Services đã được build lại với code mới
- [ ] Services đã được restart
- [ ] Prometheus đang scrape services (check /targets)
- [ ] Metrics endpoints có kafka metrics (`curl http://localhost:2000/actuator/prometheus | grep kafka`)
- [ ] Đã tạo traffic (orders) để generate Kafka messages
- [ ] Prometheus queries trả về data
- [ ] Grafana dashboard hiển thị data
- [ ] Thresholds và alerts hoạt động đúng

---

## 🎓 LƯU Ý QUAN TRỌNG

1. **Metrics chỉ có data khi có traffic** - Nếu chưa có orders, metrics sẽ không có data
2. **Rate functions cần ít nhất 2 data points** - Đợi ít nhất 2 scrape intervals
3. **Histogram percentiles cần nhiều samples** - Cần nhiều requests để histogram chính xác
4. **Counter metrics luôn tăng** - Dùng `rate()` để xem tốc độ thay đổi

---

## 🚀 COMMANDS NHANH

```bash
# 1. Rebuild tất cả
docker-compose up -d --build

# 2. Restart chỉ backend services
docker-compose restart order-service payment-service product-service notification-service restaurant-service prometheus

# 3. Xem logs
docker logs order-service -f | grep kafka
docker logs payment-service -f | grep kafka

# 4. Test metrics
curl http://localhost:2000/actuator/prometheus | grep kafka
curl http://localhost:4000/actuator/prometheus | grep kafka

# 5. Test Prometheus
curl http://localhost:9090/api/v1/query?query=order_service_kafka_producer_messages_total

# 6. Cấp quyền và chạy script kiểm tra
chmod +x check-kafka-metrics.sh
./check-kafka-metrics.sh
```

---

✅ **Sau khi làm theo guide này, Kafka metrics sẽ hiển thị đầy đủ trên Grafana dashboard!**

