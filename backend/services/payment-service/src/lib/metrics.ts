import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'payment_service_',
});

// Custom metrics for Payment Service
export const httpRequestCounter = new promClient.Counter({
  name: 'payment_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'payment_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const paymentCounter = new promClient.Counter({
  name: 'payment_service_payments_total',
  help: 'Total number of payments',
  labelNames: ['provider', 'status'],
  registers: [register],
});

export const paymentAmountHistogram = new promClient.Histogram({
  name: 'payment_service_payment_amount',
  help: 'Payment amount distribution',
  labelNames: ['provider', 'currency'],
  buckets: [10000, 50000, 100000, 500000, 1000000, 5000000],
  registers: [register],
});

export default register;

