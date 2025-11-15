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

export default register;

