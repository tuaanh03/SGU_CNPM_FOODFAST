import API_BASE_URL from "@/config/api";
import { authService } from "./auth.service";

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  avatar?: string;
  cover?: string;
  address: string;
  ward: string;
  district: string;
  province: string;
  phone?: string;
  email?: string;
  openTime?: string;
  closeTime?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreRequest {
  name: string;
  description?: string;
  avatar?: string;
  cover?: string;
  address: string;
  ward: string;
  district: string;
  province: string;
  phone?: string;
  email?: string;
  openTime?: string;
  closeTime?: string;
}

export interface UpdateStoreRequest extends Partial<CreateStoreRequest> {
  isActive?: boolean;
}

export interface StoreResponse {
  success: boolean;
  data: Store;
  message?: string;
}

class StoreService {
  // Lấy cửa hàng của merchant hiện tại
  async getMyStore(): Promise<StoreResponse> {
    const token = authService.getToken("STORE_ADMIN");
    if (!token) {
      throw new Error("Vui lòng đăng nhập");
    }

    const response = await fetch(`${API_BASE_URL}/stores/my/store`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy thông tin cửa hàng" }));
      throw new Error(error.message || "Lỗi khi lấy thông tin cửa hàng");
    }

    return response.json();
  }

  // Tạo cửa hàng mới
  async createStore(data: CreateStoreRequest): Promise<StoreResponse> {
    const token = authService.getToken("STORE_ADMIN");
    if (!token) {
      throw new Error("Vui lòng đăng nhập");
    }

    const response = await fetch(`${API_BASE_URL}/stores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi tạo cửa hàng" }));
      throw new Error(error.message || "Lỗi khi tạo cửa hàng");
    }

    return response.json();
  }

  // Cập nhật thông tin cửa hàng
  async updateStore(data: UpdateStoreRequest): Promise<StoreResponse> {
    const token = authService.getToken("STORE_ADMIN");
    if (!token) {
      throw new Error("Vui lòng đăng nhập");
    }

    const response = await fetch(`${API_BASE_URL}/stores/my/store`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi cập nhật cửa hàng" }));
      throw new Error(error.message || "Lỗi khi cập nhật cửa hàng");
    }

    return response.json();
  }
}

export const storeService = new StoreService();

