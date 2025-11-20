import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import bodyParser from "body-parser";
import compression from "compression";
import proxy from "express-http-proxy";
import { config } from "./config/index";
import express, { Request, Response , NextFunction, RequestHandler } from "express";
import { authLimiter, orderLimiter } from "./utils/limiters";
import { authenticateToken } from "./middleware/auth";
import metricsRegister, {
  httpRequestCounter,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  proxyRequestCounter,
  proxyDuration,
  proxyErrorCounter,
  rateLimitHitsCounter,
  activeConnectionsGauge
} from './metrics';

env.config();

const server = express();
const PORT = config.port;

/** CORS origins - support Vercel and other deployments */
const defaultCorsOrigins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost",
    "https://sgucnpmfoodfast-production.up.railway.app",
    "https://sgu-cnpm-foodfast.vercel.app",
    "https://restaurant-merchant.vercel.app"
];

const corsOrigins = process.env.ALLOWED_ORIGINS
    ? [...defaultCorsOrigins, ...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())]
    : defaultCorsOrigins;

console.log('✅ CORS origins:', corsOrigins);

/** 1) CORS đặt trước mọi middleware/route */
server.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization","X-Requested-With"]
}));

/** 2) Tắt etag + chặn cache để tránh 304 trong dev */
server.disable("etag");
server.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
});

/** Trả lời preflight sớm, không để rơi vào proxy */
server.options("/api/*", cors());
server.options("*", cors());

server.use(helmet());

// JSON logger cho Loki
// Custom JSON token for structured logging
morgan.token('json', (req: any, res: any) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
    service: 'api-gateway',
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
server.use(compression());
server.use(bodyParser.json());

// ==================== METRICS MIDDLEWARE ====================

// Track HTTP metrics for all requests
server.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Track request size
  const reqSize = parseInt(req.get('content-length') || '0', 10);
  const route = req.route?.path || req.path;

  if (reqSize > 0) {
    httpRequestSize.observe({ method: req.method, route }, reqSize);
  }

  // Increment active connections
  activeConnectionsGauge.inc();

  // On response finish
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestCounter.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDuration.observe({ method: req.method, route, status_code: statusCode }, duration);

    // Track response size
    const resSize = parseInt(res.get('content-length') || '0', 10);
    if (resSize > 0) {
      httpResponseSize.observe({ method: req.method, route }, resSize);
    }

    // Decrement active connections
    activeConnectionsGauge.dec();
  });

  next();
});

// ==================== END METRICS MIDDLEWARE ====================

/** Helper: decorator chung để gắn CORS header vào response từ proxy */
const addCorsOnProxyResp = {
    userResHeaderDecorator: (headers: any, req: any) => {
        const origin = req.headers.origin;
        if (corsOrigins.includes(origin)) {
            headers["Access-Control-Allow-Origin"] = origin;
        }
        headers["Access-Control-Allow-Credentials"] = "true";
        headers["Vary"] = "Origin";
        delete headers["etag"];
        return headers;
    }
};

/** Helper: xoá conditional headers (tránh 304) khi forward */
const dropConditionalHeaders = {
    proxyReqOptDecorator: (proxyReqOpts: any) => {
        if (proxyReqOpts.headers) {
            delete proxyReqOpts.headers["if-none-match"];
            delete proxyReqOpts.headers["If-None-Match"];
            delete proxyReqOpts.headers["if-modified-since"];
            delete proxyReqOpts.headers["If-Modified-Since"];
        }
        return proxyReqOpts;
    }
};

/** Helper: Forward thông tin user đã xác thực từ Gateway đến service */
const forwardUserInfo = {
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: any) => {
        if (srcReq.user) {
            proxyReqOpts.headers = proxyReqOpts.headers || {};
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
            proxyReqOpts.headers['x-user-email'] = srcReq.user.email;
            proxyReqOpts.headers['x-user-role'] = srcReq.user.role;
        }
        return proxyReqOpts;
    }
};

// Helper: Track proxy metrics
const trackProxyMetrics = (serviceName: string) => ({
  proxyReqOptDecorator: (proxyReqOpts: any, srcReq: any) => {
    // Start timer for proxy duration
    const start = Date.now();
    (srcReq as any).__proxyStart = start;
    (srcReq as any).__proxyService = serviceName;
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes: any, proxyResData: any, userReq: any) => {
    // Calculate proxy duration
    const duration = (Date.now() - (userReq as any).__proxyStart) / 1000;
    const service = (userReq as any).__proxyService || serviceName;

    // Record metrics
    proxyDuration.observe({ service }, duration);

    if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 400) {
      proxyRequestCounter.inc({ service, status: 'success' });
    } else {
      proxyRequestCounter.inc({ service, status: 'error' });
    }

    return proxyResData;
  },
  proxyErrorHandler: (err: any, res: any, next: any) => {
    const service = serviceName;
    proxyErrorCounter.inc({ service, error_type: err.code || 'unknown' });
    next(err);
  }
});

// proxy middleware for User Service (handles both /auth and /payment-methods)
const userServiceProxy = proxy(config.userServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('user-service')
});

// proxy middleware for Order Service (với user info forwarding)
const orderServiceProxy = proxy(config.orderServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...forwardUserInfo,
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('order-service')
});

// proxy middleware for Payment Service (với user info forwarding)
const paymentServiceProxy = proxy(config.paymentServiceUrl, {
    proxyReqPathResolver: (req) => {
        // VNPay return URL: giữ nguyên path (không có /api prefix)
        if (req.originalUrl.startsWith("/vnpay_return")) {
            console.log(`[Payment Proxy] VNPay Return: ${req.originalUrl} → ${req.originalUrl}`);
            return req.originalUrl;
        }

        // Các routes khác: remove /api prefix
        const newPath = req.originalUrl.replace(/^\/api/, "");
        console.log(`[Payment Proxy] API Route: ${req.originalUrl} → ${newPath}`);
        return newPath;
    },
    ...forwardUserInfo,
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('payment-service')
});

// proxy middleware for Product Service (thêm bỏ conditional headers)
const productServiceProxy = proxy(config.productServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...dropConditionalHeaders,
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('product-service')
});

// proxy middleware for Restaurant Service (với user info forwarding cho protected routes)
const restaurantServiceProxy = proxy(config.restaurantServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...forwardUserInfo,
    ...dropConditionalHeaders,
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('restaurant-service')
});

// proxy middleware for Cart Service (với user info forwarding)
const cartServiceProxy = proxy(config.cartServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...forwardUserInfo,
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('cart-service')
});

// proxy middleware for Location Service (public routes)
const locationServiceProxy = proxy(config.locationServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp,
    ...trackProxyMetrics('location-service')
});

// ====== AGGREGATION ENDPOINT ======
// GET /api/restaurants/:restaurantId/menu
// Gọi song song restaurant-service và product-service, gom kết quả trả về client
server.get(
    "/api/restaurants/:restaurantId/menu",
    (async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { restaurantId } = req.params;

            const [restaurantResponse, productsResponse] = await Promise.all([
                fetch(`${config.restaurantServiceUrl}/stores/${restaurantId}`),
                fetch(`${config.productServiceUrl}/products?storeId=${restaurantId}`)
            ]);

            if (!restaurantResponse.ok) {
                res.status(404).json({ success: false, message: "Không tìm thấy nhà hàng" });
                return;
            }

            const restaurantJson = await restaurantResponse.json();
            const productsJson   = productsResponse.ok ? await productsResponse.json() : null;

            res.json({
                success: true,
                data: {
                    restaurant: restaurantJson.data,
                    products: productsJson?.success ? productsJson.data : { products: [], pagination: null }
                }
            });
        } catch (err) {
            next(err); // chuẩn Express
        }
    }) as RequestHandler // (tùy chọn) ép kiểu về RequestHandler cho chắc
);


// user service routes (không cần xác thực, user-service tự xử lý)
server.use("/api/auth", authLimiter, userServiceProxy);
server.use("/api/payment-methods", userServiceProxy);
server.use("/api/addresses", userServiceProxy);

// order service routes (có xác thực từ Gateway)
server.use("/api/order", orderLimiter, authenticateToken, orderServiceProxy);

// ==================== PAYMENT SERVICE ROUTES ====================

// ⚠️ QUAN TRỌNG: Route order và path matching
// Express.use() matches PREFIX, nên cần tách riêng /api/payments và /api/payment

// 1. VNPay Callbacks - Public routes (NO AUTHENTICATION)
// VNPay IPN endpoint - /api/payments/* (plural "payments")
server.use("/api/payments", paymentServiceProxy);

// VNPay Return URL - /vnpay_return (không có /api prefix)
server.use("/vnpay_return", paymentServiceProxy);

// 2. Payment API endpoints - Protected routes (WITH AUTHENTICATION)
// Payment API - /api/payment/* (singular "payment")
server.use("/api/payment", authenticateToken, paymentServiceProxy);

console.log('✅ Payment routes configured:');
console.log('  - /api/payments/* → Payment Service (NO AUTH - includes /vnpay_ipn)');
console.log('  - /vnpay_return → Payment Service (NO AUTH - user redirect)');
console.log('  - /api/payment/* → Payment Service (WITH AUTH - API calls)');

// ================================================================

// product service routes (không cần xác thực cho GET, POST/PUT/DELETE cần xác thực)
server.use("/api/products", productServiceProxy);
server.use("/api/categories", productServiceProxy);

// location service routes (public routes)
server.use("/api/locations", locationServiceProxy);

// restaurant service routes
server.use("/api/stores", restaurantServiceProxy);

// cart service routes (có xác thực từ Gateway)
server.use("/api/cart", authenticateToken, cartServiceProxy);

// health check route
server.get("/", (_req: Request, res: Response) => {
    res.json({ success: true, message: "API Gateway is running" });
});

// frontend route demo
server.get("/payment-result", (req: Request, res: Response) => {
    res.json({ success: true, message: "Payment result page", query: req.query });
});

// Metrics endpoint for Prometheus
server.get('/metrics', async (_req: Request, res: Response) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Health endpoint
server.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// fallback - log chi tiết để debug
server.use((req: Request, res: Response) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
        method: req.method
    });
});

server.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`);
});
