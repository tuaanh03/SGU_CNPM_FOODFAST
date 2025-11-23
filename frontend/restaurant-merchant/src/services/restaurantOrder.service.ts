import API_BASE_URL from "@/config/api";
import { authService } from "./auth.service";

export interface RestaurantOrder {
  id: string;
  orderId: string;
  storeId: string;
  items: any[];
  totalPrice: number;
  customerInfo: any;
  restaurantStatus: string;
  receivedAt: string;
  confirmedAt?: string;
  readyAt?: string;
}

class RestaurantOrderService {
  async getMyOrders(params: { page?: number; limit?: number; status?: string } = {}) {
    const token = authService.getToken("STORE_ADMIN");
    if (!token) throw new Error("Vui lòng đăng nhập");

    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status) qs.set('status', params.status);

    const url = `${API_BASE_URL}/stores/my/orders?${qs.toString()}`;

    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Lỗi khi lấy đơn hàng' }));
      throw new Error(err.message || 'Lỗi khi lấy đơn hàng');
    }

    return res.json();
  }

  async notifyReady(restaurantOrderId: string) {
    const token = authService.getToken("STORE_ADMIN");
    if (!token) throw new Error("Vui lòng đăng nhập");

    const url = `${API_BASE_URL}/stores/orders/${restaurantOrderId}/ready`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Lỗi khi thông báo đội giao' }));
      throw new Error(err.message || 'Lỗi khi thông báo đội giao');
    }

    return res.json();
  }
}

export const restaurantOrderService = new RestaurantOrderService();

