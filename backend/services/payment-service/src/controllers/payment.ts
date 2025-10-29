import { Request, Response } from "express";
import { publishEvent } from "../utils/kafka";

export const vnpayReturn = async (req: Request, res: Response) => {
    console.log("VNPAY callback received:", req.query);

    // Lấy thông tin từ VNPay callback
    const vnp_ResponseCode = req.query.vnp_ResponseCode as string;
    const vnp_TxnRef = req.query.vnp_TxnRef as string; // Đây là paymentIntentId
    const vnp_Amount = req.query.vnp_Amount as string;
    const vnp_OrderInfo = req.query.vnp_OrderInfo as string;

    // Extract orderId từ OrderInfo
    const orderIdMatch = vnp_OrderInfo?.match(/Order\s+([a-f0-9-]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : vnp_TxnRef;

    // Xác định trạng thái thanh toán
    const paymentStatus = vnp_ResponseCode === "00" ? "success" : "failed";
    const amount = parseInt(vnp_Amount || "0") / 100; // VNPay trả về amount * 100

    console.log(`VNPay callback - OrderId: ${orderId}, TxnRef: ${vnp_TxnRef}, Status: ${paymentStatus}`);

    try {
        // Publish event để cập nhật order status
        await publishEvent(
            orderId,
            "", // userId không cần thiết cho callback
            "system@vnpay.com",
            amount,
            "VNPay Payment", // item description
            paymentStatus,
            vnp_TxnRef
        );

        console.log(`Published payment result event for order ${orderId}: ${paymentStatus}`);

        // Redirect user đến trang kết quả thanh toán của frontend
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const redirectUrl = `${frontendUrl}/payment-result?status=${paymentStatus}&orderId=${orderId}&ref=${vnp_TxnRef}`;

        res.redirect(redirectUrl);
    } catch (error) {
        console.error("Error processing VNPay callback:", error);
        res.status(500).json({
            success: false,
            message: "Error processing payment callback"
        });
    }
};

