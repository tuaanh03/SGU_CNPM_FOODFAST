import { Request, Response } from "express";
import { publishEvent } from "../utils/kafka";
import { vnpay } from "../utils/vnpay";
import {
    IpnFailChecksum,
    IpnOrderNotFound,
    IpnInvalidAmount,
    InpOrderAlreadyConfirmed,
    IpnUnknownError,
    IpnSuccess,
} from 'vnpay';

/**
 * VNPay IPN (Instant Payment Notification) handler
 * Xử lý thông báo từ VNPay khi giao dịch hoàn tất
 */
export const vnpayIPN = async (req: Request, res: Response) => {
    try {
        console.log("VNPay IPN received:", req.query);

        // Bước 1 & 2: Verify IPN call using vnpay library
        const verify = vnpay.verifyIpnCall(req.query as any);

        if (!verify.isVerified) {
            console.error("Invalid signature in VNPay IPN");
            return res.json(IpnFailChecksum);
        }

        console.log("✓ VNPay IPN signature verified successfully");

        if (!verify.isSuccess) {
            console.error("VNPay IPN - Payment not successful");
            return res.json(IpnUnknownError);
        }

        // Bước 3: Lấy thông tin giao dịch từ verify object
        const orderId = verify.vnp_TxnRef;
        const amount = Number(verify.vnp_Amount) / 100; // VNPay trả về amount * 100
        const orderInfo = verify.vnp_OrderInfo;
        const transactionNo = verify.vnp_TransactionNo;
        const rspCode = verify.vnp_ResponseCode;

        console.log(`VNPay IPN - OrderId: ${orderId}, RspCode: ${rspCode}, Amount: ${amount}, TransactionNo: ${transactionNo}`);

        // Bước 4: Xử lý business logic
        try {
            // Extract orderId từ OrderInfo nếu có
            const orderIdMatch = orderInfo?.match(/Order\s+([a-f0-9-]+)/);
            const extractedOrderId = orderIdMatch ? orderIdMatch[1] : orderId;

            // TODO: Kiểm tra order tồn tại trong database
            // const order = await findOrderById(extractedOrderId);
            // if (!order) {
            //     return res.json(IpnOrderNotFound);
            // }

            // TODO: Kiểm tra số tiền khớp
            // if (order.amount !== amount) {
            //     return res.json(IpnInvalidAmount);
            // }

            // TODO: Kiểm tra order đã được confirm chưa
            // if (order.status === 'confirmed') {
            //     return res.json(InpOrderAlreadyConfirmed);
            // }

            // Publish event để cập nhật order status
            const paymentStatus = "success";
            await publishEvent(
                extractedOrderId,
                "", // userId không cần thiết cho IPN
                "system@vnpay.com",
                amount,
                orderInfo || "VNPay Payment",
                paymentStatus,
                orderId // paymentIntentId
            );

            console.log(`✓ Published payment success event for order ${extractedOrderId}`);

            // Trả về success cho VNPay
            return res.json(IpnSuccess);

        } catch (error) {
            console.error("Error processing payment:", error);
            return res.json(IpnUnknownError);
        }
    } catch (error) {
        console.error("Error in VNPay IPN handler:", error);
        return res.json(IpnUnknownError);
    }
};

/**
 * VNPay Return URL handler
 * Xử lý khi user được redirect về từ VNPay payment page
 */
export const vnpayReturn = async (req: Request, res: Response) => {
    console.log("VNPay Return callback received:", req.query);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    try {
        // Verify return URL using vnpay library
        const verify = vnpay.verifyReturnUrl(req.query as any);

        if (!verify.isVerified) {
            console.error("Invalid signature in VNPay Return URL");
            return res.redirect(`${frontendUrl}/payment-result?status=failed&error=invalid_signature`);
        }

        console.log("✓ VNPay Return signature verified successfully");

        // Lấy thông tin từ verify object
        const vnp_TxnRef = verify.vnp_TxnRef;
        const vnp_Amount = Number(verify.vnp_Amount) / 100; // VNPay trả về amount * 100
        const vnp_OrderInfo = verify.vnp_OrderInfo;

        // Extract orderId từ OrderInfo
        const orderIdMatch = vnp_OrderInfo?.match(/Order\s+([a-f0-9-]+)/);
        const orderId = orderIdMatch ? orderIdMatch[1] : vnp_TxnRef;

        // Xác định trạng thái thanh toán
        const paymentStatus = verify.isSuccess ? "success" : "failed";

        console.log(`VNPay Return - OrderId: ${orderId}, TxnRef: ${vnp_TxnRef}, Status: ${paymentStatus}`);

        // Redirect user đến trang kết quả thanh toán của frontend
        const redirectUrl = `${frontendUrl}/payment-result?status=${paymentStatus}&orderId=${orderId}&ref=${vnp_TxnRef}&amount=${vnp_Amount}`;
        res.redirect(redirectUrl);

    } catch (error) {
        console.error("Error processing VNPay Return callback:", error);
        res.redirect(`${frontendUrl}/payment-result?status=error&message=processing_error`);
    }
};

