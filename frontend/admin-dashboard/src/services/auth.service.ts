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
  // Đăng ký system admin
  async registerSystemAdmin(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/system-admin/register`, {
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

  // Đăng nhập system admin
  async loginSystemAdmin(data: LoginRequest): Promise<AuthResponse> {
    console.log("🔐 Attempting login to:", `${API_BASE_URL}/auth/system-admin/login`);
    console.log("📧 Email:", data.email);

    const response = await fetch(`${API_BASE_URL}/auth/system-admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    console.log("📡 Response status:", response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Lỗi khi đăng nhập" }));
      console.error("❌ Login failed:", error);
      throw new Error(error.message || "Lỗi khi đăng nhập");
    }

    const result = await response.json();
    console.log("✅ Login successful:", result);
    return result;
  }

  // Lưu token và user info vào localStorage (theo pattern của project)
  saveAuthData(token: string, user: User) {
    localStorage.setItem("system_admin_token", token);
    localStorage.setItem("system_admin_user", JSON.stringify(user));
  }

  // Lấy token từ localStorage
  getToken(): string | null {
    return localStorage.getItem("system_admin_token");
  }

  // Lấy user info từ localStorage
  getUser(): User | null {
    const userStr = localStorage.getItem("system_admin_user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // Đăng xuất
  logout() {
    localStorage.removeItem("system_admin_token");
    localStorage.removeItem("system_admin_user");
  }

  // Lấy thông tin profile
  async getProfile(): Promise<{ success: boolean; data: User }> {
    const token = this.getToken();
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

  // Kiểm tra đã đăng nhập chưa
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();

// Helper function để lấy token cho API calls (dùng bởi các services khác)
export const getAuthToken = (): string | null => {
  return localStorage.getItem("system_admin_token");
};



