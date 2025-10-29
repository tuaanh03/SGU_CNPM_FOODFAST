import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { createOrder, getOrderStatus, getPaymentUrl, getUserOrders, createOrderFromCart, retryPayment } from "../controllers/order";

export const orderRoute: Router = Router();

orderRoute.post("/create", authMiddleware, createOrder);
orderRoute.post("/create-from-cart", authMiddleware, createOrderFromCart); // Workflow mới
orderRoute.get("/status/:orderId", authMiddleware, getOrderStatus);
orderRoute.get("/payment-url/:orderId", authMiddleware, getPaymentUrl);
orderRoute.get("/list", authMiddleware, getUserOrders);
orderRoute.post("/retry-payment/:orderId", authMiddleware, retryPayment); // Retry payment
