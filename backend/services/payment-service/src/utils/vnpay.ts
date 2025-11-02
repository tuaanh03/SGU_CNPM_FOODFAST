import env from "dotenv";
import { VNPay, HashAlgorithm, ProductCode, VnpLocale } from "vnpay";

env.config();

const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE as string;
const VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET as string;
const VNPAY_API_URL = process.env.VNPAY_API_URL as string;
const VNPAY_RETURN_URL = process.env.VNPAY_RETURN_URL as string;

// Initialize VNPay instance
export const vnpay = new VNPay({
    tmnCode: VNPAY_TMN_CODE,
    secureSecret: VNPAY_HASH_SECRET,
    vnpayHost: VNPAY_API_URL,
    testMode: true, // Set to false in production
    hashAlgorithm: HashAlgorithm.SHA512,
});

export async function processPayment(
    orderId: string,
    userId: string,
    amount: number,
    item: string
) {
    try {
        const txnRef = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Use vnpay library to build payment URL
        // NOTE: IPN URL phải được cấu hình trong VNPay Merchant Portal
        // không thể truyền qua API với thư viện này
        const paymentUrl = vnpay.buildPaymentUrl({
            vnp_Amount: amount,
            vnp_IpAddr: '127.0.0.1',
            vnp_TxnRef: txnRef,
            vnp_OrderInfo: `Order ${orderId} - ${item}`,
            vnp_OrderType: ProductCode.Other,
            vnp_ReturnUrl: VNPAY_RETURN_URL,
            vnp_Locale: VnpLocale.VN,
        });

        return { success: true, paymentIntentId: txnRef, paymentUrl };
    } catch (error: any) {
        console.error(`Payment failed for order ${orderId}:`, error.message);
        return { success: false, error: error.message };
    }
}