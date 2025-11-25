import API_BASE_URL from "@/config/api";

export interface Drone {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  battery: number;
  maxPayload: number;
  maxRange: number;
  currentLat?: number;
  currentLng?: number;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  status: 'AVAILABLE' | 'IN_USE' | 'CHARGING' | 'MAINTENANCE' | 'OFFLINE';
  distanceFromRestaurant?: number; // in km
  distance?: number; // in km (alias)
  lastMaintenance?: string;
  createdAt: string;
  updatedAt: string;
}

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
  drone?: Drone;
  trackingPoints?: TrackingPoint[];
}

export interface TrackingPoint {
  id: string;
  deliveryId: string;
  lat: number;
  lng: number;
  altitude?: number;
  speed?: number;
  battery: number;
  timestamp: string;
}

export interface Order {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  restaurantName: string;
  restaurantAddress: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
  route?: RouteInfo;
}

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface RouteInfo {
  distance: number; // in km
  estimatedTime: number; // in minutes
  waypoints: Waypoint[];
}

export interface Waypoint {
  lat: number;
  lng: number;
  address: string;
  type: 'restaurant' | 'customer';
}

class DroneService {
  private getAuthHeader() {
    const token = localStorage.getItem('system_admin_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  // Drone Management
  async getAllDrones(status?: string) {
    const url = status
      ? `${API_BASE_URL}/drones?status=${status}`
      : `${API_BASE_URL}/drones`;

    const response = await fetch(url, {
      headers: this.getAuthHeader(),
    });
    return response.json();
  }

  async getAvailableDrones() {
    const response = await fetch(`${API_BASE_URL}/drones/available`, {
      headers: this.getAuthHeader(),
    });
    return response.json();
  }

  async getDroneById(id: string) {
    const response = await fetch(`${API_BASE_URL}/drones/${id}`, {
      headers: this.getAuthHeader(),
    });
    return response.json();
  }

  // Get drone realtime location from Redis
  async getDroneLocation(id: string): Promise<{ success: boolean; data: { lat: number; lng: number; source: 'redis' | 'database' } }> {
    const response = await fetch(`${API_BASE_URL}/drones/${id}/location`, {
      headers: this.getAuthHeader(),
    });
    return response.json();
  }

  async createDrone(data: {
    name: string;
    model: string;
    serialNumber: string;
    maxPayload?: number;
    maxRange?: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/drones`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateDrone(id: string, data: Partial<Drone>) {
    const response = await fetch(`${API_BASE_URL}/drones/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateDroneLocation(id: string, data: {
    currentLat: number;
    currentLng: number;
    battery?: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/drones/${id}/location`, {
      method: 'PATCH',
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteDrone(id: string) {
    const response = await fetch(`${API_BASE_URL}/drones/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });
    return response.json();
  }

  // Delivery Management
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
    return response.json();
  }

  async getDeliveryById(id: string) {
    const response = await fetch(`${API_BASE_URL}/deliveries/${id}`, {
      headers: this.getAuthHeader(),
    });
    return response.json();
  }

  async getDeliveryByOrderId(orderId: string) {
    const response = await fetch(`${API_BASE_URL}/deliveries/order/${orderId}`, {
      headers: this.getAuthHeader(),
    });
    return response.json();
  }

  async createDelivery(data: {
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
  }) {
    const response = await fetch(`${API_BASE_URL}/deliveries`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async updateDeliveryStatus(id: string, status: Delivery['status']) {
    const response = await fetch(`${API_BASE_URL}/deliveries/${id}/status`, {
      method: 'PATCH',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ status }),
    });
    return response.json();
  }

  async addTrackingPoint(deliveryId: string, data: {
    lat: number;
    lng: number;
    altitude?: number;
    speed?: number;
    battery: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/deliveries/${deliveryId}/tracking`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });
    return response.json();
  }
}

export const droneService = new DroneService();

