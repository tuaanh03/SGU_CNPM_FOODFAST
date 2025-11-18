import env from "dotenv";
import { VNPay, HashAlgorithm, ProductCode, VnpLocale } from "vnpay";

env.config();

const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE as string;
const VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET as string;
const VNPAY_API_URL = process.env.VNPAY_API_URL as string;

// Lấy RETURN_URL từ biến môi trường
// Nếu không có, fallback về frontend URL + path
const getReturnUrl = (): string => {
    if (process.env.VNPAY_RETURN_URL) {
        return process.env.VNPAY_RETURN_URL;
    }

    // Fallback: dùng FRONTEND_URL nếu có
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/payment-result`;
};

const VNPAY_RETURN_URL = getReturnUrl();

console.log('✅ VNPay Config:');
console.log('  - TMN_CODE:', VNPAY_TMN_CODE);
console.log('  - API_URL:', VNPAY_API_URL);
console.log('  - RETURN_URL:', VNPAY_RETURN_URL);

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

        console.log(`✅ Created payment URL for order ${orderId}, txnRef: ${txnRef}`);

        return { success: true, paymentIntentId: txnRef, paymentUrl };
    } catch (error: any) {
        console.error(`❌ Payment failed for order ${orderId}:`, error.message);
        return { success: false, error: error.message };
    }
}