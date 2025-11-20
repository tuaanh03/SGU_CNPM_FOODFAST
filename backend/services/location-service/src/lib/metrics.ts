import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'location_service_',
});

// Custom metrics for Location Service
export const httpRequestCounter = new promClient.Counter({
  name: 'location_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'location_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Geocoding Metrics
export const geocodingRequestsCounter = new promClient.Counter({
  name: 'location_service_geocoding_requests_total',
  help: 'Total number of geocoding requests',
  labelNames: ['type', 'status'], // type: forward | reverse | search; status: success | failed
  registers: [register],
});

export const geocodingDuration = new promClient.Histogram({
  name: 'location_service_geocoding_duration_seconds',
  help: 'Geocoding request duration',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const externalApiCallsCounter = new promClient.Counter({
  name: 'location_service_external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['provider', 'status'], // provider: nominatim; status: success | failed
  registers: [register],
});

// Cache Metrics
export const cacheOperationsCounter = new promClient.Counter({
  name: 'location_service_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation'], // operation: hit | miss | set | eviction
  registers: [register],
});

export const cacheHitRate = new promClient.Gauge({
  name: 'location_service_cache_hit_rate',
  help: 'Cache hit rate (0-1)',
  registers: [register],
});

export const cacheSizeGauge = new promClient.Gauge({
  name: 'location_service_cache_size_gauge',
  help: 'Current cache size',
  registers: [register],
});

export default register;

