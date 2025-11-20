import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'api_gateway_',
});

// ==================== HTTP Metrics ====================

export const httpRequestCounter = new promClient.Counter({
  name: 'api_gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'api_gateway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10], // As per monitoring guide
  registers: [register],
});

export const httpRequestSize = new promClient.Histogram({
  name: 'api_gateway_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

export const httpResponseSize = new promClient.Histogram({
  name: 'api_gateway_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// ==================== Proxy Metrics ====================

export const proxyRequestCounter = new promClient.Counter({
  name: 'api_gateway_proxy_requests_total',
  help: 'Total number of proxy requests to backend services',
  labelNames: ['service', 'status'], // status: success | error
  registers: [register],
});

export const proxyDuration = new promClient.Histogram({
  name: 'api_gateway_proxy_duration_seconds',
  help: 'Proxy request duration in seconds',
  labelNames: ['service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const proxyErrorCounter = new promClient.Counter({
  name: 'api_gateway_proxy_errors_total',
  help: 'Total number of proxy errors',
  labelNames: ['service', 'error_type'],
  registers: [register],
});

// ==================== Rate Limiting Metrics ====================

export const rateLimitHitsCounter = new promClient.Counter({
  name: 'api_gateway_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'action'], // action: allowed | blocked
  registers: [register],
});

// ==================== Active Connections ====================

export const activeConnectionsGauge = new promClient.Gauge({
  name: 'api_gateway_active_connections',
  help: 'Number of currently active connections',
  registers: [register],
});

export default register;

