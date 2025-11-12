import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { storeService, type Store } from "@/services/store.service";
import MerchantLayout from "@/components/MerchantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router";
import { Loader2, Store as StoreIcon, MapPin, Phone, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

const MerchantDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async () => {
    try {
      const response = await storeService.getMyStore();
      setStore(response.data);
    } catch (error: any) {
      // Nếu chưa có store, chuyển đến trang setup
      if (error.message.includes("chưa có cửa hàng") || error.message.includes("404")) {
        toast.info("Bạn chưa có cửa hàng, vui lòng tạo cửa hàng");
        navigate("/merchant/setup");
      } else {
        toast.error(error.message || "Lỗi khi lấy thông tin cửa hàng");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!store) {
    return null; // Đã redirect đến setup page
  }

  return (
    <MerchantLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Thông tin cửa hàng */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StoreIcon className="w-5 h-5" />
              Thông tin cửa hàng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-gray-500 mb-1">Tên cửa hàng</h3>
                  <p className="text-base">{store.name}</p>
                </div>

                {store.description && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 mb-1">Mô tả</h3>
                    <p className="text-base text-gray-700">{store.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-sm text-gray-500 mb-1 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Địa chỉ
                  </h3>
                  <p className="text-base">
                    {store.address}, {store.ward}, {store.district}, {store.province}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {store.phone && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 mb-1 flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Số điện thoại
                    </h3>
                    <p className="text-base">{store.phone}</p>
                  </div>
                )}

                {store.email && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 mb-1 flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email
                    </h3>
                    <p className="text-base">{store.email}</p>
                  </div>
                )}

                {(store.openTime || store.closeTime) && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Giờ hoạt động
                    </h3>
                    <p className="text-base">
                      {store.openTime || "N/A"} - {store.closeTime || "N/A"}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-sm text-gray-500 mb-1">Trạng thái</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    store.isActive 
                      ? "bg-green-100 text-green-800" 
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {store.isActive ? "Đang hoạt động" : "Tạm đóng"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Các tính năng quản lý */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/merchant/products")}
          >
            <CardHeader>
              <CardTitle>Quản lý Menu</CardTitle>
              <CardDescription>Thêm, sửa, xóa món ăn</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Quản lý thực đơn và danh mục món ăn
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Quản lý đơn hàng</CardTitle>
              <CardDescription>Xem và xử lý đơn hàng</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Tính năng đang được phát triển
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Thống kê doanh thu</CardTitle>
              <CardDescription>Xem báo cáo và thống kê</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Tính năng đang được phát triển
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Đánh giá</CardTitle>
              <CardDescription>Xem đánh giá từ khách hàng</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Tính năng đang được phát triển
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Khuyến mãi</CardTitle>
              <CardDescription>Quản lý mã giảm giá và ưu đãi</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Tính năng đang được phát triển
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Cài đặt</CardTitle>
              <CardDescription>Cài đặt cửa hàng</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Tính năng đang được phát triển
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Thông tin tài khoản */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Thông tin tài khoản Merchant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Tên</p>
                <p className="font-medium">{user?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Số điện thoại</p>
                <p className="font-medium">{user?.phone || "Chưa cập nhật"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                  {user?.role}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MerchantLayout>
  );
};

export default MerchantDashboardPage;

