import { Router, Request, Response, NextFunction } from "express";
import { vnpayReturn, vnpayIPN, getPaymentUrl } from "../controllers/payment";

export const paymentRoute: Router = Router();

// Wrapper function to handle async route handlers
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// VNPAY return URL handler - User redirect từ VNPay
paymentRoute.get("/vnpay_return", asyncHandler(vnpayReturn));

// VNPAY IPN handler - Server-to-server notification từ VNPay
paymentRoute.get("/vnpay_ipn", asyncHandler(vnpayIPN));

// API để lấy payment URL của order - Frontend sẽ poll endpoint này
paymentRoute.get("/payment-url/:orderId", asyncHandler(getPaymentUrl));

