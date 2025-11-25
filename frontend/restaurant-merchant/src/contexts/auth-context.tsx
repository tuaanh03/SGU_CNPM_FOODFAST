"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService, type User, type LoginRequest, type RegisterRequest } from '@/services/auth.service';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginCustomer: (data: LoginRequest) => Promise<void>;
  loginAdmin: (data: LoginRequest) => Promise<void>;
  registerCustomer: (data: RegisterRequest) => Promise<void>;
  registerAdmin: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Khi app khởi động, kiểm tra xem có token trong localStorage không
  useEffect(() => {
    const initAuth = async () => {
      // Migration: Chuyển từ key cũ sang key mới
      const oldToken = localStorage.getItem("token");
      const oldUser = localStorage.getItem("user");
      if (oldToken && oldUser) {
        try {
          const user = JSON.parse(oldUser);
          const prefix = user.role === "STORE_ADMIN" ? "admin" : "customer";
          localStorage.setItem(`${prefix}_token`, oldToken);
          localStorage.setItem(`${prefix}_user`, oldUser);
          // Xóa key cũ
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        } catch (e) {
          // Nếu parse lỗi, xóa luôn
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }

      // Kiểm tra path để quyết định load user nào
      const isAdminPath = window.location.pathname.startsWith('/admin');

      let savedUser: User | null = null;

      if (isAdminPath) {
        // Nếu đang ở admin path, ưu tiên load admin user
        savedUser = authService.getUser("STORE_ADMIN");
        if (!savedUser) {
          // Nếu không có admin user, thử customer user
          savedUser = authService.getUser("CUSTOMER");
        }
      } else {
        // Nếu đang ở customer path, ưu tiên load customer user
        savedUser = authService.getUser("CUSTOMER");
        if (!savedUser) {
          // Nếu không có customer user, thử admin user
          savedUser = authService.getUser("STORE_ADMIN");
        }
      }

      if (savedUser) {
        setUser(savedUser);

        // Validate token bằng cách gọi API
        try {
          const response = await authService.getProfile(savedUser.role as "CUSTOMER" | "STORE_ADMIN");
          setUser(response.data);
        } catch (error) {
          // Token không hợp lệ, xóa đi
          authService.logout(savedUser.role as "CUSTOMER" | "STORE_ADMIN");
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Lắng nghe sự kiện storage để sync giữa các tabs
    const handleStorageChange = (e: StorageEvent) => {
      // Nếu có thay đổi từ tab khác về localStorage auth
      if (e.key?.includes('_user') || e.key?.includes('_token')) {
        // Kiểm tra path hiện tại để load đúng user
        const isAdminPath = window.location.pathname.startsWith('/admin');
        const targetRole: "CUSTOMER" | "STORE_ADMIN" = isAdminPath ? "STORE_ADMIN" : "CUSTOMER";
        const savedUser = authService.getUser(targetRole);
        setUser(savedUser);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loginCustomer = async (data: LoginRequest) => {
    try {
      const response = await authService.loginCustomer(data);
      setUser(response.data.user);
      authService.saveAuthData(response.data.token, response.data.user);
      toast.success(response.message || "Đăng nhập thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi đăng nhập");
      throw error;
    }
  };

  const loginAdmin = async (data: LoginRequest) => {
    try {
      const response = await authService.loginAdmin(data);
      setUser(response.data.user);
      authService.saveAuthData(response.data.token, response.data.user);
      toast.success(response.message || "Đăng nhập thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi đăng nhập");
      throw error;
    }
  };

  const registerCustomer = async (data: RegisterRequest) => {
    try {
      const response = await authService.registerCustomer(data);
      setUser(response.data.user);
      authService.saveAuthData(response.data.token, response.data.user);
      toast.success(response.message || "Đăng ký thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi đăng ký");
      throw error;
    }
  };

  const registerAdmin = async (data: RegisterRequest) => {
    try {
      const response = await authService.registerAdmin(data);
      setUser(response.data.user);
      authService.saveAuthData(response.data.token, response.data.user);
      toast.success(response.message || "Đăng ký thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi đăng ký");
      throw error;
    }
  };

  const logout = () => {
    const currentRole = user?.role as "CUSTOMER" | "STORE_ADMIN" | undefined;
    authService.logout(currentRole);

    // Xóa cart localStorage nếu là customer logout
    if (currentRole === "CUSTOMER") {
      localStorage.removeItem('cart_restaurantId');
      localStorage.removeItem('cart_restaurant');
    }

    // ✅ Xóa storeInfo nếu là merchant logout
    if (currentRole === "STORE_ADMIN") {
      localStorage.removeItem('storeInfo');
      console.log('🗑️ [AuthContext] Cleared storeInfo from localStorage on logout');
    }

    setUser(null);
    toast.success("Đã đăng xuất");
  };

  const refreshProfile = async () => {
    if (!user) return;

    try {
      const response = await authService.getProfile(user.role as "CUSTOMER" | "STORE_ADMIN");
      setUser(response.data);
      authService.saveAuthData(authService.getToken(user.role as "CUSTOMER" | "STORE_ADMIN")!, response.data);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi lấy thông tin người dùng");
      // Nếu lỗi, có thể token đã hết hạn
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginCustomer,
        loginAdmin,
        registerCustomer,
        registerAdmin,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

