import env from "dotenv";
import * as crypto from "crypto";

env.config();

const VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE as string;
const VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET as string;
const VNPAY_API_URL = process.env.VNPAY_API_URL as string;
const VNPAY_RETURN_URL = process.env.VNPAY_RETURN_URL as string;

export async function processPayment(
    orderId: string,
    userId: string,
    amount: number,
    item: string
) {
    try {
        const txnRef = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const createDate = new Date()
            .toISOString()
            .replace(/[-:TZ]/g, "")
            .slice(0, 14);

        const rawParams: Record<string, string> = {
            vnp_Version: "2.1.0",
            vnp_Command: "pay",
            vnp_TmnCode: VNPAY_TMN_CODE,
            vnp_Locale: "vn",
            vnp_CurrCode: "VND",
            vnp_TxnRef: txnRef,
            vnp_OrderInfo: `Order ${orderId} - ${item}`,
            vnp_OrderType: "other",
            vnp_Amount: Math.round(amount * 100).toString(),
            vnp_ReturnUrl: VNPAY_RETURN_URL,
            vnp_IpAddr: "127.0.0.1",
            vnp_CreateDate: createDate,
        };

        const sortedKeys = Object.keys(rawParams).sort();
        const params = new URLSearchParams();
        for (const key of sortedKeys) {
            params.append(key, rawParams[key]);
        }

        const signData = params.toString();
        const signed = crypto
            .createHmac("sha512", VNPAY_HASH_SECRET)
            .update(Buffer.from(signData, "utf-8"))
            .digest("hex");

        params.append("vnp_SecureHash", signed);
        const paymentUrl = `${VNPAY_API_URL}?${params.toString()}`;

        return { success: true, paymentIntentId: txnRef, paymentUrl };
    } catch (error: any) {
        console.error(`Payment failed for order ${orderId}:`, error.message);
        return { success: false, error: error.message };
    }
}