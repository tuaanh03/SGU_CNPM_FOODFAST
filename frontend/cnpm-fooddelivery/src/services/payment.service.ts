import API_BASE_URL from "@/config/api";

export interface PaymentUrlResponse {
  success: boolean;
  status: string;
  paymentUrl?: string;
  paymentIntentId?: string;
  paymentAttemptId?: string;
  amount?: number;
  message?: string;
}

class PaymentService {
  private getAuthHeader() {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Vui lòng đăng nhập");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // Lấy payment URL của order (poll cho đến khi có URL hoặc timeout)
  async getPaymentUrl(orderId: string, maxRetries = 10, delayMs = 1000): Promise<PaymentUrlResponse> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${API_BASE_URL}/payment/payment-url/${orderId}`, {
          method: "GET",
          headers: this.getAuthHeader(),
        });

        const data = await response.json();

        // Nếu đã có payment URL, return luôn
        if (data.success && data.paymentUrl) {
          return data;
        }

        // Nếu payment đã thành công, return luôn
        if (data.status === "SUCCEEDED") {
          return data;
        }

        // Nếu đang xử lý (202), chờ và retry
        if (response.status === 202) {
          console.log(`Đang chờ payment URL... (thử lần ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Nếu có lỗi khác, throw
        if (!response.ok) {
          throw new Error(data.message || "Lỗi khi lấy thông tin thanh toán");
        }

        // Nếu không có payment URL nhưng status 200, chờ và retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error: any) {
        console.error(`Error getting payment URL (attempt ${i + 1}/${maxRetries}):`, error);

        // Nếu là lần thử cuối, throw error
        if (i === maxRetries - 1) {
          throw error;
        }

        // Chờ và retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Timeout
    throw new Error("Không thể lấy payment URL, vui lòng thử lại sau");
  }
}

export const paymentService = new PaymentService();

