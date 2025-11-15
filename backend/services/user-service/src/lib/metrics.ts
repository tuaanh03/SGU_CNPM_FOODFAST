import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'user_service_',
});

// Custom metrics for User Service
export const httpRequestCounter = new promClient.Counter({
  name: 'user_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'user_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const authCounter = new promClient.Counter({
  name: 'user_service_auth_total',
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const activeUsers = new promClient.Gauge({
  name: 'user_service_active_users',
  help: 'Number of currently active users',
  registers: [register],
});

export default register;

