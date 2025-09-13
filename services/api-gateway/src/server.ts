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

// middleware's
server.use(cors());
server.use(helmet());
server.use(morgan("dev"));
server.use(compression());
server.use(bodyParser.json());

// proxy middleware for User Service (handles both /auth and /payment-methods)
const userServiceProxy = proxy(config.userServiceUrl, {
  proxyReqPathResolver: (req) => {
    const newPath = req.originalUrl.replace(/^\/api/, "");
    return newPath;
  },
});

// proxy middleware for Order Service
const orderServiceProxy = proxy(config.orderServiceUrl, {
  proxyReqPathResolver: (req) => {
    const newPath = req.originalUrl.replace(/^\/api/, "");
    return newPath;
  },
});

// proxy middleware for Payment Service
const paymentServiceProxy = proxy(config.paymentServiceUrl, {
  proxyReqPathResolver: (req) => {
    // For VNPay return URL, keep the original path without /api prefix
    if (req.originalUrl.startsWith('/vnpay_return')) {
      return req.originalUrl;
    }
    const newPath = req.originalUrl.replace(/^\/api/, "");
    return newPath;
  },
});

// user service routes
server.use("/api/auth", authLimiter, userServiceProxy);
server.use("/api/payment-methods", userServiceProxy);

// order service routes
server.use("/api/order", orderLimiter, orderServiceProxy);

// payment service routes - VNPay return URL (không cần /api prefix)
server.use("/vnpay_return", paymentServiceProxy);

// payment service routes - API routes (với /api prefix)
server.use("/api/payment", paymentServiceProxy);

// health check route
server.get("/", (req: Request, res: Response) => {
  res.json({ success: true, message: "API Gateway is running" });
});

// Handler cho frontend routes - payment result page
server.get("/payment-result", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Payment result page",
    query: req.query
  });
});

// fallback route for unmatched requests
server.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

server.listen(PORT, () => {
  console.log(`API Gateway is running on port ${PORT}`);
});
