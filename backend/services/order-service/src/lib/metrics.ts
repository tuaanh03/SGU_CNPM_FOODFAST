import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'order_service_',
});

// Custom metrics for Order Service
export const httpRequestCounter = new promClient.Counter({
  name: 'order_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'order_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const orderCounter = new promClient.Counter({
  name: 'order_service_orders_total',
  help: 'Total number of orders',
  labelNames: ['status', 'action'],
  registers: [register],
});

export const orderProcessingDuration = new promClient.Histogram({
  name: 'order_service_processing_duration_seconds',
  help: 'Order processing duration in seconds',
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Business Metrics
export const ordersCreatedCounter = new promClient.Counter({
  name: 'order_service_orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status', 'action'], // action: created | confirmed | cancelled | expired
  registers: [register],
});

export const orderProcessingDurationByStatus = new promClient.Histogram({
  name: 'order_service_processing_duration_by_status_seconds',
  help: 'Order processing duration by status',
  labelNames: ['status'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const orderValueHistogram = new promClient.Histogram({
  name: 'order_service_order_value_histogram',
  help: 'Distribution of order values',
  buckets: [50000, 100000, 200000, 500000, 1000000, 2000000], // VND
  registers: [register],
});

export const activeSessionsGauge = new promClient.Gauge({
  name: 'order_service_active_sessions_gauge',
  help: 'Number of active order sessions',
  registers: [register],
});

export const sessionExpirationsCounter = new promClient.Counter({
  name: 'order_service_session_expirations_total',
  help: 'Total number of session expirations',
  registers: [register],
});

export const sessionOperationsCounter = new promClient.Counter({
  name: 'order_service_session_operations_total',
  help: 'Total number of session operations',
  labelNames: ['operation'], // operation: create | extend | expire
  registers: [register],
});

export default register;

