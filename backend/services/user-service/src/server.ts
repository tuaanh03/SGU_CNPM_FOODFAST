import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";

// Import routes
import authRoutes from "./routes/auth.routes";
import addressRoutes from "./routes/address.routes";
import paymentMethodRoutes from "./routes/payment-methods.routes";

// Import metrics
import metricsRegister, { httpRequestCounter, httpRequestDuration } from "./lib/metrics";

env.config();

const server = express();

// Middleware's
server.use(express.json());
server.use(cookieParser());
server.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// JSON logger cho Loki
morgan.token('timestamp', () => new Date().toISOString());
const logFormat = JSON.stringify({
  timestamp: ':timestamp',
  level: 'info',
  service: 'user-service',
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
    message: "User service is healthy",
    service: "user-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Routes
server.use("/auth", authRoutes);
server.use("/addresses", addressRoutes);
server.use("/payment-methods", paymentMethodRoutes);

// Health Check Route
server.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "User service is running",
    service: "user-service",
    version: "1.0.0"
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

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log(`User service is running on port ${PORT}`);
});
