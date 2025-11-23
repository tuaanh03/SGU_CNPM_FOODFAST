import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { runConsumer, setSocketIO } from "./utils/kafka";

// Import metrics
import metricsRegister, {
  httpRequestCounter,
  httpRequestDuration,
  socketConnectionCounter
} from "./lib/metrics";

env.config();

const app = express();
const httpServer = createServer(app);

// Parse allowed origins from environment variable
// Default includes localhost ports for development
const defaultOrigins = "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,https://admin-dashboard-one-rosy-75.vercel.app,https://sgu-cnpm-foodfast.vercel.app,https://restaurant-merchant.vercel.app,https://api-gateway-service-production-04a1.up.railway.app";
const allowedOrigins = (process.env.SOCKET_CORS_ORIGINS || defaultOrigins)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

console.log('🔐 Allowed CORS origins:', allowedOrigins);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Set Socket.IO instance for Kafka consumer
setSocketIO(io);

// Middleware's
app.use(express.json());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Custom JSON token for structured logging
morgan.token('json', (req: any, res: any) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
    service: 'socket-service',
    method: req.method,
    path: req.originalUrl || req.url,
    status: res.statusCode.toString(),
    responseTime: res.responseTime || 0,
    contentLength: res.get('content-length') || 0,
    userAgent: req.get('user-agent') || '',
    ip: req.ip || req.connection?.remoteAddress || ''
  });
});

app.use(morgan(':json'));

// Metrics middleware - track all HTTP requests
app.use((req: Request, res: Response, next: NextFunction) => {
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
app.get("/actuator/prometheus", async (req: Request, res: Response) => {
  res.set("Content-Type", metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Health Check Route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Socket service is healthy",
    service: "socket-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
  });
});

// Root route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Socket service is running",
    service: "socket-service",
    version: "1.0.0",
  });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🔌 New socket connection: ${socket.id}`);
  socketConnectionCounter.inc({ event_type: "connect" });

  // Join restaurant room
  socket.on("join:restaurant", (data: { storeId: string }) => {
    const { storeId } = data;
    if (storeId) {
      socket.join(`restaurant:${storeId}`);
      console.log(`🏪 Socket ${socket.id} joined restaurant:${storeId}`);
      socket.emit("joined:restaurant", { storeId, success: true });
    }
  });

  // Join order room (for customer tracking)
  socket.on("join:order", (data: { orderId: string }) => {
    const { orderId } = data;
    if (orderId) {
      socket.join(`order:${orderId}`);
      console.log(`📦 Socket ${socket.id} joined order:${orderId}`);
      socket.emit("joined:order", { orderId, success: true });
    }
  });

  // Join dispatch room (for admin dispatchers)
  socket.on("join:dispatch", () => {
    socket.join("dispatch");
    console.log(`🚚 Socket ${socket.id} joined dispatch room`);
    socket.emit("joined:dispatch", { success: true });
  });

  // Leave restaurant room
  socket.on("leave:restaurant", (data: { storeId: string }) => {
    const { storeId } = data;
    if (storeId) {
      socket.leave(`restaurant:${storeId}`);
      console.log(`🏪 Socket ${socket.id} left restaurant:${storeId}`);
    }
  });

  // Leave order room
  socket.on("leave:order", (data: { orderId: string }) => {
    const { orderId } = data;
    if (orderId) {
      socket.leave(`order:${orderId}`);
      console.log(`📦 Socket ${socket.id} left order:${orderId}`);
    }
  });

  // Leave dispatch room
  socket.on("leave:dispatch", () => {
    socket.leave("dispatch");
    console.log(`🚚 Socket ${socket.id} left dispatch room`);
  });

  // Disconnect event
  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    socketConnectionCounter.inc({ event_type: "disconnect" });
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 3011;

httpServer.listen(PORT, async () => {
  console.log(`🚀 Socket service is running on port ${PORT}`);

  // Start Kafka consumer
  try {
    await runConsumer();
    console.log('✅ Kafka consumer started for socket-service');
  } catch (err) {
    console.error('❌ Failed to start Kafka consumer:', err);
  }
});

