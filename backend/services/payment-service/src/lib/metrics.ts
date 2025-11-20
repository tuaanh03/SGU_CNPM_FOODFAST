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

// Business Metrics
export const paymentIntentsCounter = new promClient.Counter({
  name: 'payment_service_payment_intents_total',
  help: 'Total number of payment intents',
  labelNames: ['status'], // status: REQUIRES_PAYMENT | PROCESSING | SUCCEEDED | FAILED
  registers: [register],
});

export const paymentAttemptsCounter = new promClient.Counter({
  name: 'payment_service_payment_attempts_total',
  help: 'Total number of payment attempts',
  labelNames: ['status'], // status: success | failed
  registers: [register],
});

export const paymentValueHistogram = new promClient.Histogram({
  name: 'payment_service_payment_amount_histogram',
  help: 'Distribution of payment amounts',
  buckets: [50000, 100000, 200000, 500000, 1000000, 2000000, 5000000], // VND
  registers: [register],
});

export const paymentProcessingDuration = new promClient.Histogram({
  name: 'payment_service_payment_processing_duration_seconds',
  help: 'Payment processing duration by gateway',
  labelNames: ['gateway'], // gateway: vnpay | stripe
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// VNPay Integration Metrics
export const vnpayApiCallsCounter = new promClient.Counter({
  name: 'payment_service_vnpay_api_calls_total',
  help: 'Total number of VNPay API calls',
  labelNames: ['endpoint', 'status'], // status: success | error
  registers: [register],
});

export const vnpayResponsesCounter = new promClient.Counter({
  name: 'payment_service_vnpay_responses_total',
  help: 'Total number of VNPay responses by code',
  labelNames: ['response_code'],
  registers: [register],
});

export const vnpayCallbackDuration = new promClient.Histogram({
  name: 'payment_service_vnpay_callback_duration_seconds',
  help: 'VNPay callback processing duration',
  labelNames: ['type'], // type: return | ipn
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export default register;

