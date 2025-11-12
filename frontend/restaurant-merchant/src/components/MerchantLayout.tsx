import { type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Store as StoreIcon, Package, ShoppingCart, BarChart3, Settings, LogOut } from "lucide-react";

interface MerchantLayoutProps {
  children: ReactNode;
}

const MerchantLayout = ({ children }: MerchantLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/merchant/login");
  };

  const menuItems = [
    {
      label: "Dashboard",
      icon: BarChart3,
      path: "/merchant",
      exact: true,
    },
    {
      label: "Quản lý thực đơn",
      icon: Package,
      path: "/merchant/products",
    },
    {
      label: "Đơn hàng",
      icon: ShoppingCart,
      path: "/merchant/orders",
    },
    {
      label: "Cài đặt cửa hàng",
      icon: Settings,
      path: "/merchant/settings",
    },
  ];

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <StoreIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-blue-600">Merchant Portal</h1>
              <p className="text-xs text-gray-500">Quản lý cửa hàng</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Xin chào, <strong>{user?.name}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <nav className="flex gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path, item.exact);

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative",
                    active
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
};

export default MerchantLayout;

