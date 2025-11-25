import API_BASE_URL from "@/config/api";

export interface Delivery {
  id: string;
  orderId: string;
  droneId: string;
  restaurantName: string;
  restaurantLat: number;
  restaurantLng: number;
  restaurantAddress: string;
  customerName: string;
  customerPhone: string;
  customerLat: number;
  customerLng: number;
  customerAddress: string;
  distance: number;
  estimatedTime: number;
  actualTime?: number;
  status: 'PENDING' | 'ASSIGNED' | 'PICKING_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

class DeliveryService {
  private getAuthHeader() {
    const token = localStorage.getItem('system_admin_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async getAllDeliveries(filters?: { status?: string; droneId?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.droneId) params.append('droneId', filters.droneId);

    const url = params.toString()
      ? `${API_BASE_URL}/deliveries?${params}`
      : `${API_BASE_URL}/deliveries`;

    const response = await fetch(url, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch deliveries');
    }

    return response.json();
  }

  async getDeliveryById(id: string) {
    const response = await fetch(`${API_BASE_URL}/deliveries/${id}`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch delivery');
    }

    return response.json();
  }

  async getDeliveryByOrderId(orderId: string) {
    const response = await fetch(`${API_BASE_URL}/deliveries/order/${orderId}`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Delivery not found for this order');
    }

    return response.json();
  }

  // Get delivery progress from Redis
  async getDeliveryProgress(id: string): Promise<{ success: boolean; data: { progress: number; source: 'redis' | 'default' } }> {
    const response = await fetch(`${API_BASE_URL}/deliveries/${id}/progress`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch delivery progress');
    }

    return response.json();
  }

  async updateDeliveryStatus(id: string, status: Delivery['status']) {
    const response = await fetch(`${API_BASE_URL}/deliveries/${id}/status`, {
      method: 'PATCH',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error('Failed to update delivery status');
    }

    return response.json();
  }

  async assignDrone(orderId: string, droneId: string) {
    // First, get delivery by orderId
    const deliveryResponse = await this.getDeliveryByOrderId(orderId);

    if (!deliveryResponse.success) {
      throw new Error('Delivery not found for this order');
    }

    const deliveryId = deliveryResponse.data.id;

    // Assign drone to delivery
    const response = await fetch(`${API_BASE_URL}/deliveries/${deliveryId}/assign-drone`, {
      method: 'PATCH',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ droneId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to assign drone' }));
      throw new Error(error.message || 'Failed to assign drone');
    }

    return response.json();
  }

  async verifyPickupOtp(deliveryId: string, otp: string) {
    const response = await fetch(`${API_BASE_URL}/deliveries/${deliveryId}/verify-otp`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ otp }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to verify OTP' }));
      throw new Error(error.message || 'Failed to verify OTP');
    }

    return response.json();
  }
}

export const deliveryService = new DeliveryService();

