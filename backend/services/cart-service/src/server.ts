import cors from 'cors';
import env from 'dotenv';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import { connectRedis } from './config/redis';
import cartRoutes from './routes/cart.routes';

// Import metrics
import metricsRegister, { httpRequestCounter, httpRequestDuration } from './lib/metrics';

env.config();

const server = express();

// Kết nối Redis
connectRedis();

// Middleware's
server.use(express.json());
server.use(cookieParser());
server.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

// JSON logger cho Loki
// Custom JSON token for structured logging
morgan.token('json', (req: any, res: any) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
    service: 'cart-service',
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
server.get('/actuator/prometheus', async (req: Request, res: Response) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Routes
server.use('/cart', cartRoutes);

// Health Check Route
server.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Cart service is running',
    timestamp: new Date().toISOString(),
  });
});

// Health Check for Redis
server.get('/health', async (req: Request, res: Response) => {
  try {
    const redisClient = (await import('./config/redis')).default;
    await redisClient.ping();
    res.status(200).json({
      success: true,
      message: 'Cart service and Redis are healthy',
      redis: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service unavailable',
      redis: 'disconnected',
    });
  }
});

// Error handling middleware
server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
server.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 3006;

server.listen(PORT, () => {
  console.log(`Cart service is running on port ${PORT}`);
});

export default server;

