import API_BASE_URL from "@/config/api";
import { getAuthToken } from "./auth.service";

export interface Address {
  id: string;
  userId: string;
  name: string;
  phone: string;
  address: string;
  ward: string;
  district: string;
  province: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressRequest {
  name: string;
  phone: string;
  address: string;
  ward: string;
  district: string;
  province: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface UpdateAddressRequest {
  name?: string;
  phone?: string;
  address?: string;
  ward?: string;
  district?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

class AddressService {
  private getAuthHeader() {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Vui lòng đăng nhập");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Lấy danh sách địa chỉ
   */
  async getAddresses(): Promise<Address[]> {
    const response = await fetch(`${API_BASE_URL}/addresses`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi tải địa chỉ" }));
      throw new Error(error.message || "Lỗi khi tải địa chỉ");
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Tạo địa chỉ mới
   */
  async createAddress(data: CreateAddressRequest): Promise<Address> {
    const response = await fetch(`${API_BASE_URL}/addresses`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi tạo địa chỉ" }));
      throw new Error(error.message || "Lỗi khi tạo địa chỉ");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Cập nhật địa chỉ
   */
  async updateAddress(id: string, data: UpdateAddressRequest): Promise<Address> {
    const response = await fetch(`${API_BASE_URL}/addresses/${id}`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi cập nhật địa chỉ" }));
      throw new Error(error.message || "Lỗi khi cập nhật địa chỉ");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Xóa địa chỉ
   */
  async deleteAddress(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/addresses/${id}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi xóa địa chỉ" }));
      throw new Error(error.message || "Lỗi khi xóa địa chỉ");
    }
  }

  /**
   * Đặt địa chỉ mặc định
   */
  async setDefaultAddress(id: string): Promise<Address> {
    const response = await fetch(`${API_BASE_URL}/addresses/${id}/default`, {
      method: "PATCH",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi đặt địa chỉ mặc định" }));
      throw new Error(error.message || "Lỗi khi đặt địa chỉ mặc định");
    }

    const result = await response.json();
    return result.data;
  }
}

export const addressService = new AddressService();


