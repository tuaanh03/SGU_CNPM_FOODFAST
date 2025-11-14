import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'product_service_',
});

// Custom metrics for Product Service
export const httpRequestCounter = new promClient.Counter({
  name: 'product_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'product_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const productCounter = new promClient.Counter({
  name: 'product_service_products_total',
  help: 'Total number of products',
  labelNames: ['action', 'status'],
  registers: [register],
});

export const categoryCounter = new promClient.Counter({
  name: 'product_service_categories_total',
  help: 'Total number of categories',
  labelNames: ['action', 'status'],
  registers: [register],
});

export default register;

