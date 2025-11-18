import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import { runConsumer } from "./utils/kafka";
import { paymentRoute } from "./routes/payment.routes";
import express, { NextFunction, Request, Response } from "express";

// Import metrics
import metricsRegister, { httpRequestCounter, httpRequestDuration } from "./lib/metrics";

env.config();

const server = express();

// Run kafka consumer
runConsumer();

// Middleware's
server.use(express.json());
server.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// JSON logger cho Loki
// Custom JSON token for structured logging
morgan.token('json', (req: any, res: any) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
    service: 'payment-service',
    method: req.method,
    path: req.originalUrl || req.url,
    status: res.statusCode.toString(),
    responseTime: res.responseTime || 0,
    contentLength: res.get('content-length') || 0,
    userAgent: req.get('user-agent') || '',
    ip: req.ip || req.connection?.remoteAddress || ''
  });
});

server.use(morgan(':json'));

// Metrics middleware - track all HTTP requests
server.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestCounter.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route: route,
        status_code: res.statusCode,
      },
      duration
    );
  });

  next();
});

// Prometheus metrics endpoint
server.get("/actuator/prometheus", async (req: Request, res: Response) => {
  res.set("Content-Type", metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Health Check Route
server.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Payment service is healthy",
    service: "payment-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Routes
// VNPay callbacks được gọi trực tiếp không qua /api prefix
server.use("/", paymentRoute);

// API endpoints được gọi qua /api/payment prefix từ Gateway
// Gateway sẽ remove /api và gửi /payment/xxx đến đây
server.use("/payment", paymentRoute);

// VNPay IPN được gọi qua /api/payments/vnpay_ipn từ Gateway
// Gateway sẽ remove /api và gửi /payments/vnpay_ipn đến đây
server.use("/payments", paymentRoute);

console.log('✅ Payment Service routes configured:');
console.log('  - / → Direct VNPay callbacks');
console.log('  - /payment → API Gateway routes (WITH AUTH)');
console.log('  - /payments → API Gateway VNPay IPN route (NO AUTH)');

// Health Check Route
server.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Payment service is running"
  });
});

// Error handling middleware
server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler
server.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Payment service is running on port ${process.env.PORT}`);
});
