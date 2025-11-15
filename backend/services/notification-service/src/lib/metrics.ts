import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'notification_service_',
});

// Custom metrics for Notification Service
export const httpRequestCounter = new promClient.Counter({
  name: 'notification_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'notification_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const notificationCounter = new promClient.Counter({
  name: 'notification_service_notifications_total',
  help: 'Total number of notifications sent',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const emailCounter = new promClient.Counter({
  name: 'notification_service_emails_total',
  help: 'Total number of emails sent',
  labelNames: ['status'],
  registers: [register],
});

export default register;

