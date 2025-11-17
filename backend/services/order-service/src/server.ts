import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { runConsumer } from "./utils/kafka";
import { initializeRedisExpirationListener } from "./utils/redisSessionManager";
import { orderRoute } from "./routes/order.routes";
import express, { NextFunction, Request, Response } from "express";

// Import metrics
import metricsRegister, { httpRequestCounter, httpRequestDuration } from "./lib/metrics";

env.config();

const server = express();

// run kafka consumer
runConsumer();

// Khởi tạo Redis expiration listener để tự động hủy orders hết hạn
initializeRedisExpirationListener();

// middleware's
server.use(express.json());
server.use(cookieParser());
server.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// Custom JSON token for structured logging
morgan.token('json', (req: any, res: any) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
    service: 'order-service',
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
    message: "Order service is healthy",
    service: "order-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});


// order route
server.use("/order", orderRoute);

// Health Check Route
server.get("/", (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Order service is running" });
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
  console.log(`Order service is running on port ${process.env.PORT}`);
});
