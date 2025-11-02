"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService, type User, type LoginRequest, type RegisterRequest } from '@/services/auth.service';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
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
      const token = authService.getToken();
      if (token) {
        // Có token, lấy user info từ localStorage hoặc gọi API
        const savedUser = authService.getUser();
        if (savedUser) {
          setUser(savedUser);
        } else {
          // Nếu không có user info, gọi API để lấy
          try {
            const response = await authService.getProfile();
            setUser(response.data);
            localStorage.setItem("user", JSON.stringify(response.data));
          } catch (error) {
            // Token không hợp lệ, xóa đi
            authService.logout();
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (data: LoginRequest) => {
    try {
      const response = await authService.login(data);
      setUser(response.data.user);
      authService.saveAuthData(response.data.token, response.data.user);
      toast.success(response.message || "Đăng nhập thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi đăng nhập");
      throw error;
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      const response = await authService.register(data);
      setUser(response.data.user);
      authService.saveAuthData(response.data.token, response.data.user);
      toast.success(response.message || "Đăng ký thành công");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi đăng ký");
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    toast.success("Đã đăng xuất");
  };

  const refreshProfile = async () => {
    try {
      const response = await authService.getProfile();
      setUser(response.data);
      localStorage.setItem("user", JSON.stringify(response.data));
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
        login,
        register,
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

