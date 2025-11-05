import API_BASE_URL from "@/config/api";
import { getAuthToken } from "./auth.service";

export interface CreateOrderFromCartRequest {
  storeId: string;
  deliveryAddress: string;
  contactPhone: string;
  note?: string;
}

export interface OrderResponse {
  success: boolean;
  data: {
    orderId: string;
    userId: string;
    storeId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
    totalPrice: number;
    deliveryAddress: string;
    contactPhone: string;
    note?: string;
    status: string;
    createdAt: string;
  };
  message?: string;
}

class OrderService {
  private getAuthHeader() {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Vui lòng đăng nhập để đặt hàng");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // Tạo order từ giỏ hàng
  async createOrderFromCart(data: CreateOrderFromCartRequest): Promise<OrderResponse> {
    const response = await fetch(`${API_BASE_URL}/order/create-from-cart`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi tạo đơn hàng" }));
      throw new Error(error.message || "Lỗi khi tạo đơn hàng");
    }

    return response.json();
  }

  // Lấy danh sách đơn hàng của user
  async getMyOrders(): Promise<{ success: boolean; data: any[] }> {
    const response = await fetch(`${API_BASE_URL}/order/my-orders`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy danh sách đơn hàng" }));
      throw new Error(error.message || "Lỗi khi lấy danh sách đơn hàng");
    }

    return response.json();
  }

  // Lấy chi tiết đơn hàng
  async getOrderDetail(orderId: string): Promise<{ success: boolean; data: any }> {
    const response = await fetch(`${API_BASE_URL}/order/${orderId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy chi tiết đơn hàng" }));
      throw new Error(error.message || "Lỗi khi lấy chi tiết đơn hàng");
    }

    return response.json();
  }

  // Retry payment cho đơn hàng pending
  async retryPayment(orderId: string): Promise<{ success: boolean; message: string; data?: any }> {
    const response = await fetch(`${API_BASE_URL}/order/retry-payment/${orderId}`, {
      method: "POST",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi thử lại thanh toán" }));
      throw new Error(error.message || "Lỗi khi thử lại thanh toán");
    }

    return response.json();
  }
}

export const orderService = new OrderService();

