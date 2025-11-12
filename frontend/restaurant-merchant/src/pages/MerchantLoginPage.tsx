import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { storeService } from "@/services/store.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const MerchantLoginPage = () => {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Đăng nhập
      await loginAdmin({ email, password });

      // Kiểm tra xem merchant đã có store chưa
      try {
        await storeService.getMyStore();
        // Nếu có store rồi, chuyển đến dashboard
        navigate("/merchant");
      } catch (error: any) {
        // Nếu chưa có store (404), chuyển đến trang tạo store
        if (error.message.includes("chưa có cửa hàng") || error.message.includes("404")) {
          navigate("/merchant/setup");
        } else {
          // Lỗi khác, vẫn cho vào dashboard (có thể là lỗi network)
          toast.warning("Không thể kiểm tra thông tin cửa hàng, vui lòng thử lại sau");
          navigate("/merchant");
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500/10 via-background to-indigo-500/10 p-4">
      <Card className="w-full max-w-md shadow-lg border-blue-200">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-3xl">🏪</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Đăng nhập Merchant</CardTitle>
          <CardDescription className="text-center">
            Đăng nhập vào hệ thống quản lý nhà hàng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="merchant@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Chưa có tài khoản merchant?{" "}
              <Link to="/merchant/register" className="text-blue-600 hover:underline font-medium">
                Đăng ký ngay
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantLoginPage;

