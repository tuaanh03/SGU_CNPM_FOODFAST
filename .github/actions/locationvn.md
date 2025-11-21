Danh sách metrics (hiện có) và ý nghĩa
payment_service_http_requests_total{method, route, status_code}
Tổng số HTTP request tới payment-service, phân theo method/route/status.
Dùng để tính RPS và tỉ lệ lỗi.
payment_service_http_request_duration_seconds{method, route, status_code}_bucket (histogram)
Thống kê độ trễ request, dùng để tính p50/p95/p99.
payment_service_payments_total{provider, status}
Tổng payment xử lý, label provider (vnpay/stripe), status (success|failed|cancelled...).
Dùng để theo dõi throughput và success rate.
payment_service_payment_amount (histogram) or payment_service_payment_amount_histogram
Phân bố giá trị giao dịch (buckets): dùng để theo dõi volume, median/percentile giá trị.
payment_service_payment_intents_total{status}
Số PaymentIntent theo trạng thái (REQUIRES_PAYMENT, PROCESSING, SUCCEEDED, FAILED).
Dùng để theo dõi funnel trạng thái thanh toán.
payment_service_payment_attempts_total{status}
Số PaymentAttempt (created/processing/succeeded/failed).
payment_service_payment_processing_duration_seconds{gateway} (histogram)
Thời gian xử lý payment theo gateway (vnpay, stripe).
payment_service_vnpay_api_calls_total{endpoint, status}
Số lần gọi API VNPay, endpoint (create_payment_url, return, ipn...), status (started|success|error).
payment_service_vnpay_responses_total{response_code}
Số response code từ VNPay (00,24,...). Dùng để phân tích lỗi theo mã.
payment_service_vnpay_callback_duration_seconds{type}_bucket
Thời gian xử lý callback VNPay, type = return | ipn.



Customer dashboard
Grafana — layout dashboard (sections + panels) and PromQL mẫu
A. Header / Summary row
Panel: Service status (up)
Query: up{job="payment-service"} or up{instance=~"$instance"}
Visualization: SingleStat / Status
Panel: Total RPS
Query: sum(rate(payment_service_http_requests_total[1m]))
Unit: req/s
Panel: Error rate %
Query: 100 * sum(rate(payment_service_http_requests_total{status_code=~"4..|5.."}[5m])) / sum(rate(payment_service_http_requests_total[5m]))
Thresholds: yellow ≥1%, orange ≥5%, red ≥10%
B. HTTP metrics (latency & volume)
Request rate (by route)
Query: sum by (route) (rate(payment_service_http_requests_total[5m]))
Panel: stacked bar/series
Latency p50/p95/p99 (overall)
p95: histogram_quantile(0.95, sum by (le) (rate(payment_service_http_request_duration_seconds_bucket[5m])))
Multiply by 1000 for ms.
Request duration distribution (heatmap) — histogram.
C. Payment business metrics (core)
Payment Intents by status
Query: sum(rate(payment_service_payment_intents_total[5m])) by (status)
Panel: pie / stacked bar
Active Payment Intents (gauge) — if you maintain gauge or compute:
Query: sum(payment_service_payment_intents_total) by (status) (or use gauge if added)
Payment attempts (created / success / failed)
Query: sum(rate(payment_service_payment_attempts_total[5m])) by (status)
Payment amount volume (sum / avg)
Sum of payments over time (VND): sum(rate(payment_service_payment_amount_sum[5m])) — if histogram provides sum/count
Or use histogram_quantile to show amount distribution:
histogram_quantile(0.5, sum by (le) (rate(payment_service_payment_amount_bucket[5m]))) → median payment
Average payment value (per minute)
Query example if using histogram_sum/histogram_count: sum(rate(payment_service_payment_amount_sum[5m])) / sum(rate(payment_service_payment_amount_count[5m]))
D. VNPay integration
VNPay API calls over time (by endpoint + status)
Query: sum(rate(payment_service_vnpay_api_calls_total[5m])) by (endpoint, status)
VNPay response codes distribution
Query: sum(rate(payment_service_vnpay_responses_total[5m])) by (response_code)
Callback timing (return vs ipn)
p95 IPN: histogram_quantile(0.95, sum by (le) (rate(payment_service_vnpay_callback_duration_seconds_bucket{type="ipn"}[5m]))) * 1000
p95 Return: same with type="return"
Mismatch detection (missing IPN)
Query: (rate(payment_service_vnpay_api_calls_total{endpoint="return"}[10m]) - rate(payment_service_vnpay_api_calls_total{endpoint="ipn"}[10m])) → if significantly > 0, potential missing IPN.


F. System metrics (node/process)
Memory resident (bytes): payment_service_process_resident_memory_bytes
CPU: rate(process_cpu_seconds_total[5m]) per instance
Open fds / handles if exported
Ví dụ panels + PromQL cụ thể (copy-paste ready)
Panel: Total request rate (all instances)
Query: sum(rate(payment_service_http_requests_total[1m]))
Panel: Error rate %
Query: 100 * sum(rate(payment_service_http_requests_total{status_code=~"4..|5.."}[5m])) / sum(rate(payment_service_http_requests_total[5m]))
Panel: p95 latency (ms)
Query: histogram_quantile(0.95, sum by (le) (rate(payment_service_http_request_duration_seconds_bucket[5m]))) * 1000
Panel: Payment intents by status
Query: sum(rate(payment_service_payment_intents_total[5m])) by (status)
Panel: Payment attempts (success vs failed)
Query: sum(rate(payment_service_payment_attempts_total[5m])) by (status)
Panel: Payment amount median (VND)
Query: histogram_quantile(0.50, sum by (le) (rate(payment_service_payment_amount_histogram_bucket[5m])))
Panel: VNPay: create_payment_url errors
Query: sum(rate(payment_service_vnpay_api_calls_total{endpoint="create_payment_url", status="error"}[5m]))
Panel: VNPay IPN p95
Query: histogram_quantile(0.95, sum by (le) (rate(payment_service_vnpay_callback_duration_seconds_bucket{type="ipn"}[5m]))) * 1000