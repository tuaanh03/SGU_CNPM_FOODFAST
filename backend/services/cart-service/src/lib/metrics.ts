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

// Business Metrics
export const cartOperationsCounter = new promClient.Counter({
  name: 'cart_service_cart_operations_total',
  help: 'Total number of cart operations',
  labelNames: ['operation'], // operation: add | update | remove | clear
  registers: [register],
});

export const activeCartsBusinessGauge = new promClient.Gauge({
  name: 'cart_service_active_carts_gauge',
  help: 'Number of currently active carts',
  registers: [register],
});

export const cartValueHistogram = new promClient.Histogram({
  name: 'cart_service_cart_value_histogram',
  help: 'Distribution of cart values',
  labelNames: ['restaurant_id'],
  buckets: [10000, 50000, 100000, 200000, 500000, 1000000], // VND
  registers: [register],
});

export const itemsPerCartHistogram = new promClient.Histogram({
  name: 'cart_service_items_per_cart_histogram',
  help: 'Distribution of items per cart',
  buckets: [1, 2, 5, 10, 20, 50],
  registers: [register],
});

export default register;

