import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import locationRoutes from "./routes/location.routes";

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
// Custom JSON token for structured logging
morgan.token('json', (req: any, res: any) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
    service: 'location-service',
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

// Root route - Service information
server.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Location Service API",
    service: "location-service",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      search: "GET /locations/search?query={text}",
      geocode: "POST /locations/geocode (body: {address: string})",
      provinces: "GET /locations/provinces",
      districts: "GET /locations/districts/:provinceCode",
      wards: "GET /locations/wards/:districtCode"
    },
    documentation: "All location endpoints are mounted at /locations",
    apiGateway: "Access via API Gateway: http://localhost:3000/api/locations/..."
  });
});

// Routes - mount tại /locations để match với API Gateway
server.use("/locations", locationRoutes);

// Health Check Route
server.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Location service is running",
    service: "location-service",
    version: "1.0.0"
  });
});

// Error handling middleware
server.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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

const PORT = process.env.PORT || 3006;

server.listen(PORT, () => {
  console.log(`🚀 Location Service is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

