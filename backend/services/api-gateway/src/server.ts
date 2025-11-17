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

env.config();

const server = express();
const PORT = config.port;

/** 1) CORS đặt trước mọi middleware/route */
server.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost",
        "https://sgucnpmfoodfast-production.up.railway.app" // cors fix
    ],
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

/** Helper: decorator chung để gắn CORS header vào response từ proxy */
const addCorsOnProxyResp = {
    userResHeaderDecorator: (headers: any) => {
        headers["Access-Control-Allow-Origin"] = "http://localhost:5173";
        headers["Access-Control-Allow-Credentials"] = "true";
        headers["Vary"] = "Origin";      // quan trọng cho CORS caching
        delete headers["etag"];           // tránh vòng 304 lần sau
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

// proxy middleware for User Service (handles both /auth and /payment-methods)
const userServiceProxy = proxy(config.userServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp
});

// proxy middleware for Order Service (với user info forwarding)
const orderServiceProxy = proxy(config.orderServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...forwardUserInfo,
    ...addCorsOnProxyResp
});

// proxy middleware for Payment Service (với user info forwarding)
const paymentServiceProxy = proxy(config.paymentServiceUrl, {
    proxyReqPathResolver: (req) => {
        if (req.originalUrl.startsWith("/vnpay_return")) return req.originalUrl;
        return req.originalUrl.replace(/^\/api/, "");
    },
    ...forwardUserInfo,
    ...addCorsOnProxyResp
});

// proxy middleware for Product Service (thêm bỏ conditional headers)
const productServiceProxy = proxy(config.productServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...dropConditionalHeaders,
    ...addCorsOnProxyResp
});

// proxy middleware for Restaurant Service (với user info forwarding cho protected routes)
const restaurantServiceProxy = proxy(config.restaurantServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...forwardUserInfo,
    ...dropConditionalHeaders,
    ...addCorsOnProxyResp
});

// proxy middleware for Cart Service (với user info forwarding)
const cartServiceProxy = proxy(config.cartServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...forwardUserInfo,
    ...addCorsOnProxyResp
});

// proxy middleware for Location Service (public routes)
const locationServiceProxy = proxy(config.locationServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp
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

// payment service routes - VNPay return URL (không cần /api prefix)
server.use("/vnpay_return", paymentServiceProxy);

// payment service routes - API routes (với /api prefix, có xác thực)
server.use("/api/payment", authenticateToken, paymentServiceProxy);

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

// fallback
server.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Route not found" });
});

server.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`);
});
