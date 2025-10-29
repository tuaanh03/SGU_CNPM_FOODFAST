import { Router } from "express";
import { vnpayReturn } from "../controllers/payment";

export const paymentRoute: Router = Router();

// VNPAY return URL handler
paymentRoute.get("/vnpay_return", vnpayReturn);

