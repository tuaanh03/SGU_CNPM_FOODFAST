import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'cart_service_',
});

// Custom metrics for Cart Service
export const httpRequestCounter = new promClient.Counter({
  name: 'cart_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'cart_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const cartOperationCounter = new promClient.Counter({
  name: 'cart_service_operations_total',
  help: 'Total number of cart operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const activeCartsGauge = new promClient.Gauge({
  name: 'cart_service_active_carts',
  help: 'Number of active carts in Redis',
  registers: [register],
});

export default register;

