import { Registry, Counter, Histogram } from 'prom-client';

// Create a Registry
const metricsRegister = new Registry();

// HTTP request counter
export const httpRequestCounter = new Counter({
  name: 'socket_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegister],
});

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'socket_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegister],
});

// Socket.IO metrics
export const socketConnectionCounter = new Counter({
  name: 'socket_service_connections_total',
  help: 'Total number of socket connections',
  labelNames: ['event_type'],
  registers: [metricsRegister],
});

export const socketEmitCounter = new Counter({
  name: 'socket_service_emits_total',
  help: 'Total number of socket emits',
  labelNames: ['event_name'],
  registers: [metricsRegister],
});

export default metricsRegister;

