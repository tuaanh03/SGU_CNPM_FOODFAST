# Monitoring Guide - Food Delivery Microservices

**Ngày cập nhật:** 19/11/2025  
**Monitoring Stack:** Prometheus + Grafana + Loki  
**Metrics Format:** Prometheus metrics  
**Log Format:** JSON structured logging

---

## 📊 Tổng quan Monitoring Stack

### Công nghệ sử dụng

```
┌─────────────────────────────────────────────┐
│           Grafana Dashboard                 │
│  (Visualization & Alerting)                 │
└─────────────────────────────────────────────┘
         ↑                    ↑
         │ Metrics            │ Logs
         │                    │
┌────────────────┐    ┌────────────────┐
│  Prometheus    │    │     Loki       │
│   (Metrics)    │    │   (Logs)       │
└────────────────┘    └────────────────┘
         ↑                    ↑
         │                    │
    ┌────┴────────────────────┴────┐
    │     Microservices             │
    │  (Expose /metrics endpoint)   │
    │  (Send JSON logs to stdout)   │
    └───────────────────────────────┘
```

### Monitoring Endpoints

Mỗi service expose các endpoints sau:
- `/metrics` - Prometheus metrics (format: OpenMetrics)
- `/health` - Health check endpoint
- Logs output: JSON format to stdout → Loki

---

## 🎯 Monitoring cho từng Service

### 1. API Gateway Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
# Total HTTP requests
api_gateway_http_requests_total{method, route, status_code}

# Request duration histogram
api_gateway_http_request_duration_seconds{method, route, status_code}
Buckets: [0.1, 0.5, 1, 2, 5, 10]

# Request size
api_gateway_http_request_size_bytes{method, route}

# Response size
api_gateway_http_response_size_bytes{method, route}
```

**Proxy Metrics:**
```
# Proxy requests to backend services
api_gateway_proxy_requests_total{service, status}

# Proxy latency
api_gateway_proxy_duration_seconds{service}

# Proxy errors
api_gateway_proxy_errors_total{service, error_type}
```

**Rate Limiting Metrics:**
```
# Rate limit hits
api_gateway_rate_limit_hits_total{endpoint, action}
action: allowed | blocked
```

**System Metrics (Default):**
```
# Node.js metrics
nodejs_heap_size_total_bytes
nodejs_heap_size_used_bytes
nodejs_external_memory_bytes
nodejs_gc_duration_seconds{kind}

# Process metrics
process_cpu_user_seconds_total
process_cpu_system_seconds_total
process_resident_memory_bytes
process_open_fds
```

#### Dashboards quan trọng

**Overall Health Dashboard:**
- Request rate (RPS)
- Error rate (4xx, 5xx)
- Response time (p50, p95, p99)
- Active connections

**Service Proxy Dashboard:**
- Proxy requests by service
- Proxy latency by service
- Proxy error rate
- Service availability

**Rate Limiting Dashboard:**
- Rate limit hits over time
- Blocked requests by endpoint
- Top blocked IPs

#### Alerts cần thiết

```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(api_gateway_http_requests_total{status_code=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High 5xx error rate on API Gateway"

# High latency
- alert: HighLatency
  expr: histogram_quantile(0.95, api_gateway_http_request_duration_seconds) > 2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "95th percentile latency > 2s"

# Service down
- alert: ServiceDown
  expr: up{job="api-gateway"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "API Gateway is down"
```

#### Log patterns cần monitor

```json
{
  "level": "error",
  "service": "api-gateway",
  "method": "GET",
  "path": "/api/products",
  "status": 502,
  "error": "Bad Gateway - product-service unreachable"
}
```

**Log queries (Loki):**
```logql
# All errors
{service="api-gateway"} | json | level="error"

# 5xx errors
{service="api-gateway"} | json | status=~"5.."

# Slow requests
{service="api-gateway"} | json | responseTime > 1000

# Rate limit blocks
{service="api-gateway"} | json | message=~".*rate limit.*"
```

---

### 2. User Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
user_service_http_requests_total{method, route, status_code}
user_service_http_request_duration_seconds{method, route, status_code}
```

**Authentication Metrics:**
```
# Login attempts
user_service_login_attempts_total{role, status}
status: success | failed

# Registration
user_service_registrations_total{role}

# Token verifications
user_service_token_verifications_total{status}

# Active sessions
user_service_active_sessions_gauge
```

**Database Metrics:**
```
# Database queries
user_service_db_queries_total{operation, table}
operation: select | insert | update | delete

# Query duration
user_service_db_query_duration_seconds{operation, table}

# Connection pool
user_service_db_connections{state}
state: idle | active | waiting
```

#### Dashboards

**Authentication Dashboard:**
- Login success/failure rate
- Registration rate by role
- Failed login attempts (potential attacks)
- Active sessions over time

**Database Dashboard:**
- Query rate by operation
- Query latency
- Connection pool usage
- Slow queries (> 500ms)

#### Alerts

```yaml
# High failed login rate (potential brute force)
- alert: HighFailedLoginRate
  expr: rate(user_service_login_attempts_total{status="failed"}[5m]) > 10
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "High failed login rate - possible attack"

# Database connection pool exhausted
- alert: DBConnectionPoolExhausted
  expr: user_service_db_connections{state="waiting"} > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Database connection pool exhausted"
```

#### Log patterns

```logql
# Failed logins
{service="user-service"} | json | message=~".*login failed.*"

# Database errors
{service="user-service"} | json | level="error" | message=~".*database.*"

# Slow queries
{service="user-service"} | json | message=~".*slow query.*"
```

---

### 3. Restaurant Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
restaurant_service_http_requests_total{method, route, status_code}
restaurant_service_http_request_duration_seconds{method, route, status_code}
```

**Business Metrics:**
```
# Store operations
restaurant_service_stores_total{action}
action: created | updated | deleted

# Store status
restaurant_service_active_stores_gauge

# Orders received
restaurant_service_orders_received_total{store_id}

# Order status transitions
restaurant_service_order_transitions_total{from_status, to_status}
```

**Kafka Consumer Metrics:**
```
# Messages consumed
restaurant_service_kafka_messages_consumed_total{topic, status}
status: success | error

# Consumer processing duration
restaurant_service_kafka_processing_duration_seconds{topic}

# Consumer lag
restaurant_service_kafka_consumer_lag{topic, partition}

# Consumer errors
restaurant_service_kafka_consumer_errors_total{topic, error_type}
```

#### Dashboards

**Store Management Dashboard:**
- Total active stores
- Store creation/update rate
- Top stores by orders received

**Order Processing Dashboard:**
- Orders received per store
- Order status transitions
- Average order processing time
- Order status distribution

**Kafka Consumer Dashboard:**
- Messages consumed (order.confirmed)
- Consumer lag
- Processing duration
- Error rate

#### Alerts

```yaml
# High Kafka consumer lag
- alert: HighKafkaConsumerLag
  expr: restaurant_service_kafka_consumer_lag > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Kafka consumer lag > 100 messages"

# Order processing failure
- alert: OrderProcessingFailure
  expr: rate(restaurant_service_kafka_consumer_errors_total[5m]) > 0.1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High error rate processing orders"
```

---

### 4. Product Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
product_service_http_requests_total{method, route, status_code}
product_service_http_request_duration_seconds{method, route, status_code}
```

**Business Metrics:**
```
# Product operations
product_service_products_total{action, store_id}
action: created | updated | deleted

# Product availability
product_service_available_products_gauge{store_id}

# Category operations
product_service_categories_total{action}
```

**Kafka Producer Metrics:**
```
# Messages produced
product_service_kafka_messages_produced_total{topic, status}

# Producer latency
product_service_kafka_producer_latency_seconds{topic}

# Producer errors
product_service_kafka_producer_errors_total{topic, error_type}
```

**Cache Metrics:**
```
# Cache hits/misses
product_service_cache_operations_total{operation}
operation: hit | miss | eviction
```

#### Dashboards

**Product Catalog Dashboard:**
- Total products by store
- Product availability rate
- Product operations rate
- Top categories

**Kafka Producer Dashboard:**
- Messages published (product.sync)
- Producer latency
- Failed publishes
- Throughput

#### Alerts

```yaml
# High product unavailability
- alert: HighProductUnavailability
  expr: (product_service_available_products_gauge / product_service_products_total) < 0.5
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "More than 50% products unavailable"

# Kafka producer failure
- alert: KafkaProducerFailure
  expr: rate(product_service_kafka_producer_errors_total[5m]) > 0.05
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High Kafka producer error rate"
```

---

### 5. Cart Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
cart_service_http_requests_total{method, route, status_code}
cart_service_http_request_duration_seconds{method, route, status_code}
```

**Business Metrics:**
```
# Cart operations
cart_service_operations_total{operation}
operation: add | update | remove | clear

# Active carts
cart_service_active_carts_gauge

# Cart value distribution
cart_service_cart_value_histogram{restaurant_id}

# Items per cart
cart_service_items_per_cart_histogram
```

**Redis Metrics:**
```
# Redis operations
cart_service_redis_operations_total{operation, status}
operation: get | set | delete

# Redis latency
cart_service_redis_operation_duration_seconds{operation}

# Redis connection status
cart_service_redis_connected_gauge

# Redis errors
cart_service_redis_errors_total{error_type}
```

#### Dashboards

**Cart Analytics Dashboard:**
- Active carts over time
- Average cart value
- Items per cart distribution
- Top restaurants by cart count

**Redis Performance Dashboard:**
- Redis operation rate
- Redis latency (p50, p95, p99)
- Connection pool status
- Error rate

#### Alerts

```yaml
# Redis connection lost
- alert: RedisConnectionLost
  expr: cart_service_redis_connected_gauge == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Redis connection lost - cart service unavailable"

# High Redis latency
- alert: HighRedisLatency
  expr: histogram_quantile(0.95, cart_service_redis_operation_duration_seconds) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Redis 95th percentile latency > 100ms"
```

---

### 6. Order Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
order_service_http_requests_total{method, route, status_code}
order_service_http_request_duration_seconds{method, route, status_code}
```

**Business Metrics:**
```
# Orders created
order_service_orders_total{status, action}
action: created | confirmed | cancelled | expired

# Order processing duration
order_service_processing_duration_seconds{status}

# Order value distribution
order_service_order_value_histogram
```

**Kafka Metrics:**
```
# Producer metrics
order_service_kafka_producer_messages_total{topic, status}
order_service_kafka_producer_latency_seconds{topic}

# Consumer metrics
order_service_kafka_consumer_messages_total{topic, status}
order_service_kafka_consumer_processing_duration_seconds{topic}
order_service_kafka_consumer_errors_total{topic, error_type}
```

**Redis Session Metrics:**
```
# Active order sessions
order_service_active_sessions_gauge

# Session expirations
order_service_session_expirations_total

# Session operations
order_service_session_operations_total{operation}
```

#### Dashboards

**Order Management Dashboard:**
- Orders created per hour
- Order status distribution
- Order value over time
- Average order processing time

**Order Workflow Dashboard:**
- Order conversion rate (PENDING → CONFIRMED)
- Order expiration rate
- Failed payments
- Time to payment

**Kafka Events Dashboard:**
- order.create published
- payment.event consumed
- order.confirmed published
- Consumer lag

**Redis Session Dashboard:**
- Active sessions
- Session expiration rate
- TTL distribution

#### Alerts

```yaml
# High order failure rate
- alert: HighOrderFailureRate
  expr: rate(order_service_orders_total{status="CANCELLED"}[10m]) > 0.2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "More than 20% orders are failing"

# High session expiration
- alert: HighSessionExpiration
  expr: rate(order_service_session_expirations_total[5m]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High order session expiration rate"

# Kafka consumer lag
- alert: OrderServiceConsumerLag
  expr: order_service_kafka_consumer_lag > 50
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Order service Kafka consumer lag > 50"
```

---

### 7. Payment Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
payment_service_http_requests_total{method, route, status_code}
payment_service_http_request_duration_seconds{method, route, status_code}
```

**Business Metrics:**
```
# Payment intents
payment_service_payment_intents_total{status}
status: REQUIRES_PAYMENT | PROCESSING | SUCCEEDED | FAILED

# Payment attempts
payment_service_payment_attempts_total{status}

# Payment value
payment_service_payment_amount_histogram

# Payment processing time
payment_service_payment_processing_duration_seconds{gateway}
gateway: vnpay | stripe
```

**VNPay Integration Metrics:**
```
# VNPay API calls
payment_service_vnpay_api_calls_total{endpoint, status}

# VNPay response codes
payment_service_vnpay_responses_total{response_code}

# VNPay callback latency
payment_service_vnpay_callback_duration_seconds{type}
type: return | ipn
```

**Kafka Metrics:**
```
payment_service_kafka_consumer_messages_total{topic, status}
payment_service_kafka_producer_messages_total{topic, status}
payment_service_kafka_producer_latency_seconds{topic}
```

#### Dashboards

**Payment Overview Dashboard:**
- Payment success rate
- Failed payments by reason
- Payment volume (VND)
- Average payment processing time

**VNPay Integration Dashboard:**
- VNPay API calls
- VNPay response codes distribution
- Return URL vs IPN timing
- Payment gateway availability

**Payment Workflow Dashboard:**
- PaymentIntent → PaymentAttempt funnel
- Payment retry rate
- Time from order to payment
- Payment abandonment rate

#### Alerts

```yaml
# High payment failure rate
- alert: HighPaymentFailureRate
  expr: rate(payment_service_payment_intents_total{status="FAILED"}[10m]) > 0.3
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "More than 30% payments are failing"

# VNPay integration issue
- alert: VNPayIntegrationIssue
  expr: rate(payment_service_vnpay_api_calls_total{status="error"}[5m]) > 0.1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "VNPay API error rate > 10%"

# Missing IPN callbacks
- alert: MissingIPNCallbacks
  expr: (
    rate(payment_service_vnpay_callback_duration_seconds_count{type="return"}[10m])
    - rate(payment_service_vnpay_callback_duration_seconds_count{type="ipn"}[10m])
  ) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Return callbacks > IPN callbacks (VNPay integration issue)"
```

---

### 8. Notification Service Monitoring

#### Metrics cần thu thập

**Kafka Consumer Metrics:**
```
notification_service_kafka_messages_consumed_total{topic, status}
notification_service_kafka_processing_duration_seconds{topic}
notification_service_kafka_consumer_errors_total{topic, error_type}
notification_service_kafka_consumer_lag{topic, partition}
```

**Email Metrics:**
```
# Emails sent
notification_service_emails_sent_total{type, status}
type: payment_success | payment_failed | order_confirmed
status: success | failed

# Email send duration
notification_service_email_send_duration_seconds{type}

# Email provider errors
notification_service_email_provider_errors_total{provider, error_type}
provider: resend
```

**DLQ Metrics:**
```
# Messages sent to DLQ
notification_service_dlq_messages_total{reason}

# DLQ size
notification_service_dlq_size_gauge
```

#### Dashboards

**Email Delivery Dashboard:**
- Emails sent per hour
- Email success rate by type
- Email send latency
- Failed emails by error type

**Kafka Consumer Dashboard:**
- Messages consumed
- Consumer lag
- Processing duration
- Error rate

**DLQ Dashboard:**
- DLQ message rate
- DLQ size over time
- Failed notifications by reason

#### Alerts

```yaml
# High email failure rate
- alert: HighEmailFailureRate
  expr: rate(notification_service_emails_sent_total{status="failed"}[5m]) > 0.2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "More than 20% emails are failing"

# DLQ growing
- alert: DLQGrowing
  expr: rate(notification_service_dlq_size_gauge[10m]) > 0
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Dead Letter Queue is growing"

# Consumer lag high
- alert: NotificationConsumerLag
  expr: notification_service_kafka_consumer_lag > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Notification service consumer lag > 100"
```

---

### 9. Location Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
location_service_http_requests_total{method, route, status_code}
location_service_http_request_duration_seconds{method, route, status_code}
```

**Geocoding Metrics:**
```
# Geocoding requests
location_service_geocoding_requests_total{type, status}
type: forward | reverse | search
status: success | failed

# Geocoding latency
location_service_geocoding_duration_seconds{type}

# External API calls
location_service_external_api_calls_total{provider, status}
provider: nominatim
```

**Cache Metrics:**
```
# Cache operations
location_service_cache_operations_total{operation}
operation: hit | miss | set | eviction

# Cache hit rate
location_service_cache_hit_rate

# Cache size
location_service_cache_size_gauge
```

#### Dashboards

**Geocoding Dashboard:**
- Geocoding requests per type
- Success rate
- Latency by type
- External API call rate

**Cache Performance Dashboard:**
- Cache hit rate
- Cache size over time
- Cache eviction rate
- Response time: cached vs uncached

#### Alerts

```yaml
# Low cache hit rate
- alert: LowCacheHitRate
  expr: location_service_cache_hit_rate < 0.6
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Cache hit rate < 60%"

# External API failure
- alert: GeocodingAPIFailure
  expr: rate(location_service_external_api_calls_total{status="failed"}[5m]) > 0.1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Geocoding API failure rate > 10%"
```

---

### 10. Drone Service Monitoring

#### Metrics cần thu thập

**HTTP Metrics:**
```
drone_service_http_requests_total{method, route, status_code}
drone_service_http_request_duration_seconds{method, route, status_code}
```

**Business Metrics:**
```
# Drone fleet
drone_service_total_drones_gauge{status}
status: AVAILABLE | IN_USE | CHARGING | MAINTENANCE

# Deliveries
drone_service_deliveries_total{status}
status: PENDING | ASSIGNED | IN_TRANSIT | DELIVERED | FAILED

# Delivery duration
drone_service_delivery_duration_seconds{status}

# Battery levels
drone_service_drone_battery_level_histogram
```

#### Dashboards

**Drone Fleet Dashboard:**
- Total drones by status
- Available drones over time
- Average battery level
- Drones needing maintenance

**Delivery Dashboard:**
- Deliveries per hour
- Delivery success rate
- Average delivery time
- Failed deliveries by reason

#### Alerts

```yaml
# Low available drones
- alert: LowAvailableDrones
  expr: drone_service_total_drones_gauge{status="AVAILABLE"} < 2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Less than 2 drones available"

# High delivery failure
- alert: HighDeliveryFailure
  expr: rate(drone_service_deliveries_total{status="FAILED"}[10m]) > 0.2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Delivery failure rate > 20%"
```

---

## 📈 Global Dashboards

### 1. System Overview Dashboard

**Panels:**
- Service health status (up/down)
- Overall request rate (RPS)
- Overall error rate (4xx, 5xx)
- Overall latency (p50, p95, p99)
- Active users
- Active orders
- Payment success rate

### 2. Infrastructure Dashboard

**Panels:**
- CPU usage by service
- Memory usage by service
- Disk I/O
- Network I/O
- Database connections
- Redis connections
- Kafka consumer lag

### 3. Business Metrics Dashboard

**Panels:**
- Total users (CUSTOMER, STORE_ADMIN, SYSTEM_ADMIN)
- Total restaurants
- Total products
- Orders per hour
- Revenue per hour (VND)
- Top selling products
- Top restaurants by orders

### 4. SLA Dashboard

**Metrics:**
- Uptime percentage (target: 99.9%)
- API availability (target: 99.9%)
- API latency p95 (target: < 500ms)
- Error rate (target: < 1%)
- Payment success rate (target: > 95%)

---

## 🔔 Alerting Strategy

### Alert Severity Levels

**Critical (Pager):**
- Service down
- Database down
- Payment gateway down
- High error rate (> 10%)
- Payment failure rate > 30%

**Warning (Slack/Email):**
- High latency (p95 > 2s)
- Error rate > 5%
- High consumer lag
- Low cache hit rate
- Payment failure rate > 20%

**Info (Log only):**
- Deployment notifications
- Configuration changes
- Scheduled maintenance

### Alert Routing

```yaml
# alertmanager.yml
route:
  receiver: 'default'
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  
  routes:
  - match:
      severity: critical
    receiver: pagerduty
    
  - match:
      severity: warning
    receiver: slack
    
  - match:
      severity: info
    receiver: email

receivers:
- name: 'pagerduty'
  pagerduty_configs:
  - service_key: '<pagerduty_key>'
    
- name: 'slack'
  slack_configs:
  - api_url: '<slack_webhook>'
    channel: '#alerts'
    
- name: 'email'
  email_configs:
  - to: 'team@example.com'
```

---

## 📝 Log Management

### JSON Logging Format

Tất cả services sử dụng JSON structured logging:

```json
{
  "timestamp": "2025-11-19T10:30:45.123Z",
  "level": "info",
  "service": "order-service",
  "method": "POST",
  "path": "/order/create",
  "status": 201,
  "responseTime": 145,
  "userId": "user-123",
  "orderId": "order-456",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

### Loki Label Strategy

**Labels (indexed):**
- `service` - Service name
- `level` - Log level (info, warn, error)
- `environment` - prod, staging, dev

**Fields (parsed):**
- `method`, `path`, `status`
- `userId`, `orderId`, `productId`
- `error`, `stack`

### Common Log Queries

**All errors:**
```logql
{environment="prod"} | json | level="error"
```

**Slow requests:**
```logql
{environment="prod"} | json | responseTime > 1000
```

**User activity:**
```logql
{service="user-service"} | json | userId="user-123"
```

**Order workflow:**
```logql
{service=~"order-service|payment-service"} | json | orderId="order-456"
```

**Kafka events:**
```logql
{service=~".*-service"} | json | message=~".*kafka.*"
```

---

## 🎯 Performance Targets (SLIs)

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Availability** | 99.9% | < 99% |
| **API Latency (p95)** | < 500ms | > 2s |
| **API Latency (p99)** | < 1s | > 5s |
| **Error Rate** | < 0.5% | > 5% |
| **Payment Success Rate** | > 97% | < 90% |
| **Order Success Rate** | > 95% | < 85% |
| **Email Delivery Rate** | > 98% | < 90% |
| **Database Query Latency (p95)** | < 100ms | > 500ms |
| **Redis Operation Latency (p95)** | < 10ms | > 100ms |
| **Kafka Consumer Lag** | < 10 | > 100 |

---

## 🛠️ Monitoring Tools Configuration

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:3000']
    
  - job_name: 'user-service'
    static_configs:
      - targets: ['user-service:3001']
    
  - job_name: 'order-service'
    static_configs:
      - targets: ['order-service:3002']
    
  # ... other services
```

### Grafana Datasources

```yaml
# grafana-datasource.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
```

---

## Thu thập metrics cho Azure PostgreSQL

Nếu sử dụng database PostgreSQL được deploy trên Azure, bạn có thể thu thập metrics bằng Prometheus và postgres_exporter như sau:

### 1. Triển khai postgres_exporter
- Chạy postgres_exporter trên một VM, container hoặc server có thể truy cập Azure PostgreSQL.
- Cấu hình biến môi trường kết nối đến Azure PostgreSQL:
  ```
  DATA_SOURCE_NAME=postgresql://username:password@your-azure-db.postgres.database.azure.com:5432/dbname?sslmode=require
  ```

### 2. Cấu hình Prometheus
- Thêm job scrape vào prometheus.yml:
  ```yaml
  - job_name: 'azure-postgres'
    static_configs:
      - targets: ['<postgres_exporter_host>:9187']
  ```
- Đảm bảo Prometheus có thể truy cập được postgres_exporter.

### 3. Metrics phổ biến
- pg_stat_activity_count
- pg_database_size_bytes
- pg_stat_user_tables_seq_scan
- pg_stat_user_tables_n_tup_ins
- pg_stat_user_tables_n_tup_upd
- pg_stat_user_tables_n_tup_del

### 4. Lưu ý bảo mật
- Sử dụng SSL/TLS khi kết nối đến Azure PostgreSQL.
- Không expose exporter ra internet công cộng, chỉ cho phép Prometheus truy cập.

### 5. Grafana Dashboard
- Import dashboard mẫu cho PostgreSQL để trực quan hóa các metrics.

---

> **Lưu ý:** Nếu bạn deploy database trên Azure, KHÔNG sử dụng Docker Compose cho database. Chỉ cần chạy postgres_exporter trên một máy chủ hoặc container có thể truy cập Azure PostgreSQL, cấu hình DATA_SOURCE_NAME trỏ tới Azure PostgreSQL, và cấu hình Prometheus scrape từ địa chỉ exporter (ví dụ: VM_IP:9187).
