import promClient from 'prom-client';

// Create a Registry for metrics
const register = new promClient.Registry();

// Enable default metrics collection (CPU, Memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'restaurant_service_',
});

// Custom metrics for Restaurant Service
export const httpRequestCounter = new promClient.Counter({
  name: 'restaurant_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new promClient.Histogram({
  name: 'restaurant_service_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const restaurantCounter = new promClient.Counter({
  name: 'restaurant_service_restaurants_total',
  help: 'Total number of restaurants',
  labelNames: ['action', 'status'],
  registers: [register],
});

export const activeRestaurants = new promClient.Gauge({
  name: 'restaurant_service_active_restaurants',
  help: 'Number of active restaurants',
  registers: [register],
});

// Business Metrics
export const storesCounter = new promClient.Counter({
  name: 'restaurant_service_stores_total',
  help: 'Total number of store operations',
  labelNames: ['action'], // action: created | updated | deleted
  registers: [register],
});

export const activeStoresGauge = new promClient.Gauge({
  name: 'restaurant_service_active_stores_gauge',
  help: 'Number of currently active stores',
  registers: [register],
});

export const ordersReceivedCounter = new promClient.Counter({
  name: 'restaurant_service_orders_received_total',
  help: 'Total number of orders received by stores',
  labelNames: ['store_id'],
  registers: [register],
});

export const orderTransitionsCounter = new promClient.Counter({
  name: 'restaurant_service_order_transitions_total',
  help: 'Total number of order status transitions',
  labelNames: ['from_status', 'to_status'],
  registers: [register],
});

export default register;

