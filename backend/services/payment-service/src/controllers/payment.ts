import { Request, Response } from "express";
import { publishEvent } from "../utils/kafka";
import { vnpay } from "../utils/vnpay";
import prisma from "../lib/prisma";
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

            // Xác định trạng thái payment dựa vào response code
            let paymentStatus: "success" | "cancelled" | "failed";

            if (verify.isSuccess) {
                // Response code 00: Giao dịch thành công
                paymentStatus = "success";
            } else if (rspCode === "24") {
                // Response code 24: Khách hàng hủy giao dịch
                paymentStatus = "cancelled";
                console.log(`⚠️ Payment cancelled by user for order ${extractedOrderId}`);
            } else {
                // Các response code khác: Giao dịch thất bại
                paymentStatus = "failed";
                console.log(`❌ Payment failed for order ${extractedOrderId} with code ${rspCode}`);
            }

            // Cập nhật PaymentIntent trong database
            const paymentIntent = await prisma.paymentIntent.findUnique({
                where: { orderId: extractedOrderId },
                include: {
                    attempts: {
                        where: { vnpTxnRef: orderId },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            });

            if (paymentIntent) {
                // Cập nhật PaymentIntent status
                const intentStatus = paymentStatus === "success" ? "SUCCEEDED" : "FAILED";
                await prisma.paymentIntent.update({
                    where: { id: paymentIntent.id },
                    data: {
                        status: intentStatus,
                        metadata: {
                            ...(paymentIntent.metadata as any || {}),
                            vnpResponseCode: rspCode,
                            vnpTransactionNo: transactionNo,
                            lastUpdated: new Date().toISOString()
                        }
                    }
                });

                // Cập nhật PaymentAttempt status
                if (paymentIntent.attempts && paymentIntent.attempts.length > 0) {
                    const attemptStatus = paymentStatus === "success" ? "SUCCEEDED" :
                                        paymentStatus === "cancelled" ? "CANCELED" : "FAILED";

                    await prisma.paymentAttempt.update({
                        where: { id: paymentIntent.attempts[0].id },
                        data: {
                            status: attemptStatus,
                            vnpRawResponsePayload: {
                                responseCode: rspCode,
                                transactionNo: transactionNo,
                                amount: amount,
                                timestamp: new Date().toISOString()
                            }
                        }
                    });

                    console.log(`✓ Updated PaymentIntent ${paymentIntent.id} and PaymentAttempt to ${paymentStatus}`);
                }
            }

            // Publish event để cập nhật order status
            await publishEvent(
                extractedOrderId,
                "", // userId không cần thiết cho IPN
                "system@vnpay.com",
                amount,
                orderInfo || "VNPay Payment",
                paymentStatus,
                orderId // paymentIntentId
            );

            console.log(`✓ Published payment ${paymentStatus} event for order ${extractedOrderId}`);

            // Trả về success cho VNPay (đã nhận và xử lý thông báo)
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
        const responseCode = verify.vnp_ResponseCode;

        console.log(`VNPay Return - OrderId: ${orderId}, TxnRef: ${vnp_TxnRef}, Status: ${paymentStatus}, Code: ${responseCode}`);

        // Redirect user đến trang kết quả thanh toán của frontend
        const redirectUrl = `${frontendUrl}/payment-result?status=${paymentStatus}&orderId=${orderId}&ref=${vnp_TxnRef}&amount=${vnp_Amount}`;
        res.redirect(redirectUrl);

    } catch (error) {
        console.error("Error processing VNPay Return callback:", error);
        res.redirect(`${frontendUrl}/payment-result?status=error&message=processing_error`);
    }
};

/**
 * API để lấy payment URL của một order
 * Frontend sẽ gọi API này sau khi tạo order để lấy payment URL và redirect
 */
export const getPaymentUrl = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "orderId là bắt buộc"
            });
        }

        console.log(`Getting payment URL for order: ${orderId}`);

        // Tìm PaymentIntent của order
        const paymentIntent = await prisma.paymentIntent.findUnique({
            where: { orderId },
            include: {
                attempts: {
                    where: {
                        status: {
                            in: ["PROCESSING", "CREATED"]
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            }
        });

        if (!paymentIntent) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy thông tin thanh toán cho đơn hàng này"
            });
        }

        // Kiểm tra nếu payment đã thành công
        if (paymentIntent.status === "SUCCEEDED") {
            return res.status(200).json({
                success: true,
                status: "SUCCEEDED",
                message: "Đơn hàng đã được thanh toán thành công"
            });
        }

        // Kiểm tra nếu có PaymentAttempt đang PROCESSING
        if (paymentIntent.attempts && paymentIntent.attempts.length > 0) {
            const latestAttempt = paymentIntent.attempts[0];

            // Lấy payment URL từ vnpRawRequestPayload
            const rawPayload = latestAttempt.vnpRawRequestPayload as any;
            const paymentUrl = rawPayload?.paymentUrl;

            if (paymentUrl) {
                console.log(`✅ Found payment URL for order ${orderId}: ${paymentUrl}`);

                return res.status(200).json({
                    success: true,
                    status: paymentIntent.status,
                    paymentUrl,
                    paymentIntentId: paymentIntent.id,
                    paymentAttemptId: latestAttempt.id,
                    amount: latestAttempt.amount
                });
            }
        }

        // Nếu chưa có payment URL, có thể payment service đang xử lý
        return res.status(202).json({
            success: false,
            status: paymentIntent.status,
            message: "Đang xử lý thanh toán, vui lòng thử lại sau"
        });

    } catch (error: any) {
        console.error("Error getting payment URL:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy thông tin thanh toán"
        });
    }
};

