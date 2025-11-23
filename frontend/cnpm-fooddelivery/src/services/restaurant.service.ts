import API_BASE_URL from "@/config/api";

export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  cover?: string;
  address: string;
  ward: string;
  district: string;
  province: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  openTime?: string;
  closeTime?: string;
  isActive: boolean;
  rating?: number;
  distance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NearbyRestaurantsParams {
  lat: number;
  lng: number;
  radius?: number;
  limit?: number;
}

class RestaurantService {
  async getNearbyRestaurants(
    params: NearbyRestaurantsParams
  ): Promise<{ data: Restaurant[]; meta: any }> {
    try {
      const { lat, lng, radius = 10, limit = 50 } = params;

      if (!lat || !lng) {
        throw new Error("Vui lòng cung cấp tọa độ vị trí");
      }

      const finalRadius = Math.min(radius, 10);

      const queryParams = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius: finalRadius.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(
        `${API_BASE_URL}/stores/nearby?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: "Không thể tải danh sách nhà hàng",
        }));
        throw new Error(error.message || "Không thể tải danh sách nhà hàng");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Không thể tải danh sách nhà hàng");
      }

      return {
        data: result.data || [],
        meta: result.meta || {},
      };
    } catch (error: any) {
      console.error("Get nearby restaurants error:", error);
      throw error;
    }
  }

  async getRestaurantById(id: string): Promise<Restaurant> {
    try {
      const response = await fetch(`${API_BASE_URL}/stores/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Không thể tải thông tin nhà hàng");
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      console.error("Get restaurant error:", error);
      throw error;
    }
  }

  validateDistance(distance: number): { valid: boolean; message?: string } {
    const MAX_DISTANCE = 10;

    if (distance > MAX_DISTANCE) {
      return {
        valid: false,
        message: `Nhà hàng này cách bạn ${distance.toFixed(
          1
        )}km, vượt quá bán kính giao hàng (${MAX_DISTANCE}km). Vui lòng chọn nhà hàng khác hoặc thay đổi địa chỉ giao hàng.`,
      };
    }

    return { valid: true };
  }
}

export const restaurantService = new RestaurantService();

