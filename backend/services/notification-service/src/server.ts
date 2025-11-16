import env from "dotenv";
import morgan from "morgan";
import { runConsumer } from "./utils/kafka";
import express, { NextFunction, Request, Response } from "express";

// Import metrics
import metricsRegister, { httpRequestCounter, httpRequestDuration } from "./lib/metrics";

env.config();

const server = express();

// run kafka consumer
runConsumer();

// middleware's
server.use(express.json());

// JSON logger cho Loki
morgan.token('timestamp', () => new Date().toISOString());
const logFormat = JSON.stringify({
  timestamp: ':timestamp',
  level: 'info',
  service: 'notification-service',
  method: ':method',
  path: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  ip: ':remote-addr'
});

server.use(morgan(logFormat));

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
    message: "Notification service is healthy",
    service: "notification-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health Check Route
server.get("/", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ success: true, message: "Notification service is running" });
});

// Error handling middleware
server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Notification service is running on port ${process.env.PORT}`);
});
