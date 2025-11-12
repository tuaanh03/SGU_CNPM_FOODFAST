import API_BASE_URL from "@/config/api";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
  message: string;
}

class AuthService {
  // Đăng ký customer
  async registerCustomer(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/customer/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi đăng ký" }));
      throw new Error(error.message || "Lỗi khi đăng ký");
    }

    return response.json();
  }

  // Đăng ký admin
  async registerAdmin(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/admin/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi đăng ký" }));
      throw new Error(error.message || "Lỗi khi đăng ký");
    }

    return response.json();
  }

  // Đăng nhập customer
  async loginCustomer(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/customer/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi đăng nhập" }));
      throw new Error(error.message || "Lỗi khi đăng nhập");
    }

    return response.json();
  }

  // Đăng nhập admin
  async loginAdmin(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi đăng nhập" }));
      throw new Error(error.message || "Lỗi khi đăng nhập");
    }

    return response.json();
  }

  // Lấy thông tin profile
  async getProfile(role: "CUSTOMER" | "STORE_ADMIN"): Promise<{ success: boolean; data: User }> {
    const token = this.getToken(role);
    if (!token) {
      throw new Error("Vui lòng đăng nhập");
    }

    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi lấy thông tin" }));
      throw new Error(error.message || "Lỗi khi lấy thông tin");
    }

    return response.json();
  }

  // Lưu token và user info vào localStorage theo role
  saveAuthData(token: string, user: User) {
    const prefix = user.role === "STORE_ADMIN" ? "admin" : "customer";
    localStorage.setItem(`${prefix}_token`, token);
    localStorage.setItem(`${prefix}_user`, JSON.stringify(user));
  }

  // Lấy token từ localStorage theo role
  getToken(role?: "CUSTOMER" | "STORE_ADMIN"): string | null {
    // Nếu không truyền role, tìm token nào có sẵn
    if (!role) {
      return localStorage.getItem("customer_token") || localStorage.getItem("admin_token");
    }
    const prefix = role === "STORE_ADMIN" ? "admin" : "customer";
    return localStorage.getItem(`${prefix}_token`);
  }

  // Lấy user info từ localStorage theo role
  getUser(role?: "CUSTOMER" | "STORE_ADMIN"): User | null {
    // Nếu không truyền role, tìm user nào có sẵn
    if (!role) {
      const customerStr = localStorage.getItem("customer_user");
      const adminStr = localStorage.getItem("admin_user");
      const userStr = customerStr || adminStr;
      if (!userStr) return null;
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }

    const prefix = role === "STORE_ADMIN" ? "admin" : "customer";
    const userStr = localStorage.getItem(`${prefix}_user`);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // Kiểm tra đã đăng nhập chưa theo role
  isAuthenticated(role?: "CUSTOMER" | "STORE_ADMIN"): boolean {
    return !!this.getToken(role);
  }

  // Đăng xuất theo role
  logout(role?: "CUSTOMER" | "STORE_ADMIN") {
    if (!role) {
      // Logout tất cả
      localStorage.removeItem("customer_token");
      localStorage.removeItem("customer_user");
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
    } else {
      const prefix = role === "STORE_ADMIN" ? "admin" : "customer";
      localStorage.removeItem(`${prefix}_token`);
      localStorage.removeItem(`${prefix}_user`);
    }
  }
}

export const authService = new AuthService();

// Helper function để lấy token cho API calls (dùng bởi các services khác)
export const getAuthToken = (): string | null => {
  // Ưu tiên customer token, nếu không có thì lấy admin token
  return localStorage.getItem("customer_token") || localStorage.getItem("admin_token");
};

