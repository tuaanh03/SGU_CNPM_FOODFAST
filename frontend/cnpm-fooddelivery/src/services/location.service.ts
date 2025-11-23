import API_BASE_URL from "@/config/api";

export interface GeocodeRequest {
  address: string;
  ward: string;
  district: string;
  province: string;
}

export interface GeocodeResponse {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface LocationSearchResult {
  displayName: string;
  latitude: number;
  longitude: number;
  address: string;
  ward: string;
  district: string;
  province: string;
}

class LocationService {
  async geocode(data: GeocodeRequest): Promise<GeocodeResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/locations/geocode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: "Không thể chuyển đổi địa chỉ"
        }));
        throw new Error(error.message || "Không thể chuyển đổi địa chỉ");
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error("Không tìm thấy tọa độ cho địa chỉ này");
      }

      return result.data;
    } catch (error: any) {
      console.error("Geocode error:", error);
      throw error;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<any> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/locations/reverse?lat=${lat}&lng=${lng}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Không thể chuyển đổi tọa độ");
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      console.error("Reverse geocode error:", error);
      throw error;
    }
  }

  async searchAddress(query: string, limit = 5): Promise<LocationSearchResult[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/locations/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Không thể tìm kiếm địa chỉ");
      }

      const result = await response.json();
      return result.data || [];
    } catch (error: any) {
      console.error("Search address error:", error);
      return [];
    }
  }

  async calculateDistance(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): Promise<{ distance: number; duration: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/locations/distance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to }),
      });

      if (!response.ok) {
        throw new Error("Không thể tính khoảng cách");
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      console.error("Calculate distance error:", error);
      throw error;
    }
  }
}

export const locationService = new LocationService();

