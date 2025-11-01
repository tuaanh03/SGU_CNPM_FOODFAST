import API_BASE_URL from "@/config/api";

export interface AddToCartRequest {
  restaurantId: string;
  productId: string;
  quantity: number;
  productName: string;
  productPrice: number;
  productImage: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  productName: string;
  productPrice: number;
  productImage: string;
}

export interface CartResponse {
  success: boolean;
  data: {
    userId: string;
    restaurantId: string;
    items: CartItem[];
    total: number;
  };
}

class CartService {
  private getAuthHeader() {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Vui lòng đăng nhập để sử dụng giỏ hàng");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // Thêm sản phẩm vào giỏ hàng
  async addToCart(data: AddToCartRequest): Promise<CartResponse> {
    const response = await fetch(`${API_BASE_URL}/cart/add`, {
      method: "POST",
      headers: this.getAuthHeader(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi thêm vào giỏ hàng" }));
      throw new Error(error.message || "Lỗi khi thêm vào giỏ hàng");
    }

    return response.json();
  }

  // Lấy giỏ hàng của user
  async getCart(restaurantId: string): Promise<CartResponse> {
    const response = await fetch(`${API_BASE_URL}/cart/${restaurantId}`, {
      method: "GET",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy giỏ hàng" }));
      throw new Error(error.message || "Lỗi khi lấy giỏ hàng");
    }

    return response.json();
  }

  // Cập nhật số lượng sản phẩm trong giỏ hàng
  async updateQuantity(restaurantId: string, productId: string, quantity: number): Promise<CartResponse> {
    const response = await fetch(`${API_BASE_URL}/cart/${restaurantId}/${productId}`, {
      method: "PUT",
      headers: this.getAuthHeader(),
      body: JSON.stringify({ quantity }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi cập nhật giỏ hàng" }));
      throw new Error(error.message || "Lỗi khi cập nhật giỏ hàng");
    }

    return response.json();
  }

  // Xóa sản phẩm khỏi giỏ hàng
  async removeFromCart(restaurantId: string, productId: string): Promise<CartResponse> {
    const response = await fetch(`${API_BASE_URL}/cart/${restaurantId}/${productId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi xóa khỏi giỏ hàng" }));
      throw new Error(error.message || "Lỗi khi xóa khỏi giỏ hàng");
    }

    return response.json();
  }

  // Xóa toàn bộ giỏ hàng
  async clearCart(restaurantId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/cart/${restaurantId}`, {
      method: "DELETE",
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi xóa giỏ hàng" }));
      throw new Error(error.message || "Lỗi khi xóa giỏ hàng");
    }

    return response.json();
  }
}

export const cartService = new CartService();

