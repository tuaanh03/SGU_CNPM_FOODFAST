import cors from "cors";
import env from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import bodyParser from "body-parser";
import compression from "compression";
import proxy from "express-http-proxy";
import { config } from "./config/index";
import express, { Request, Response } from "express";
import { authLimiter, orderLimiter } from "./utils/limiters";

env.config();

const server = express();
const PORT = config.port;

/** 1) CORS đặt trước mọi middleware/route */
server.use(cors({
    origin: "http://localhost:5173",
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
server.use(morgan("dev"));
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

// proxy middleware for User Service (handles both /auth and /payment-methods)
const userServiceProxy = proxy(config.userServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp
});

// proxy middleware for Order Service
const orderServiceProxy = proxy(config.orderServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...addCorsOnProxyResp
});

// proxy middleware for Payment Service
const paymentServiceProxy = proxy(config.paymentServiceUrl, {
    proxyReqPathResolver: (req) => {
        if (req.originalUrl.startsWith("/vnpay_return")) return req.originalUrl;
        return req.originalUrl.replace(/^\/api/, "");
    },
    ...addCorsOnProxyResp
});

// proxy middleware for Product Service (thêm bỏ conditional headers)
const productServiceProxy = proxy(config.productServiceUrl, {
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/api/, ""),
    ...dropConditionalHeaders,
    ...addCorsOnProxyResp
});

// user service routes
server.use("/api/auth", authLimiter, userServiceProxy);
server.use("/api/payment-methods", userServiceProxy);
server.use("/api/stores", userServiceProxy);
server.use("/api/addresses", userServiceProxy);

// order service routes
server.use("/api/order", orderLimiter, orderServiceProxy);

// payment service routes - VNPay return URL (không cần /api prefix)
server.use("/vnpay_return", paymentServiceProxy);

// payment service routes - API routes (với /api prefix)
server.use("/api/payment", paymentServiceProxy);

// product service routes
server.use("/api/products", productServiceProxy);
server.use("/api/categories", productServiceProxy);



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