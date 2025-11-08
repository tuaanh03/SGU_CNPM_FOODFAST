import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "CUSTOMER" | "STORE_ADMIN";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Chuyển hướng dựa trên role yêu cầu
    const loginPath = requiredRole === "STORE_ADMIN" ? "/admin/login" : "/login";
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Kiểm tra role nếu được chỉ định
  if (requiredRole && user?.role !== requiredRole) {
    // Nếu role không khớp, chuyển về trang phù hợp
    const redirectPath = user?.role === "STORE_ADMIN" ? "/admin" : "/";
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

