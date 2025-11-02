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
  role?: "CUSTOMER" | "ADMIN" | "STORE_OWNER";
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
  // Đăng ký
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
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

  // Đăng nhập
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
  async getProfile(): Promise<{ success: boolean; data: User }> {
    const token = localStorage.getItem("token");
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

  // Lưu token và user info vào localStorage
  saveAuthData(token: string, user: User) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  }

  // Lấy token từ localStorage
  getToken(): string | null {
    return localStorage.getItem("token");
  }

  // Lấy user info từ localStorage
  getUser(): User | null {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // Kiểm tra đã đăng nhập chưa
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Đăng xuất
  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
}

export const authService = new AuthService();

