import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  LogOut,
  CheckCircle2,
  User,
  Phone,
  Calendar,
  Package,
  Truck,
  Clock,
  Navigation,
  Store
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { deliveryService } from "@/services/delivery.service";
import { toast } from "sonner";

interface DeliveryDetail {
  id: string;
  orderId: string;
  droneId: string;
  storeId: string;
  restaurantName: string;
  restaurantLat: number;
  restaurantLng: number;
  restaurantAddress: string;
  customerName: string;
  customerPhone: string;
  customerLat: number;
  customerLng: number;
  customerAddress: string;
  distance: number;
  estimatedTime: number;
  actualTime?: number;
  status: string;
  assignedAt: string;
  pickedUpAt?: string;
  deliveredAt: string;
  createdAt: string;
  drone?: {
    id: string;
    name: string;
    model: string;
    serialNumber: string;
    battery: number;
  };
}

const CompletedDeliveryDetailPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchDeliveryDetail();
    }
  }, [orderId]);

  const fetchDeliveryDetail = async () => {
    try {
      setLoading(true);
      const response = await deliveryService.getDeliveryByOrderId(orderId!);

      if (response.success) {
        setDelivery(response.data);
      }
    } catch (error) {
      console.error('Error fetching delivery detail:', error);
      toast.error('Không thể tải thông tin đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: vi });
    } catch {
      return dateString;
    }
  };

  const calculateDeliveryTime = () => {
    if (!delivery?.assignedAt || !delivery?.deliveredAt) return null;

    const start = new Date(delivery.assignedAt);
    const end = new Date(delivery.deliveredAt);
    const diffMs = end.getTime() - start.getTime();

    return Math.floor(diffMs / 60000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Không tìm thấy thông tin đơn hàng</p>
            <Button onClick={() => navigate("/completed-deliveries")}>
              Quay lại danh sách
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deliveryTime = calculateDeliveryTime();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/completed-deliveries")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Chi tiết đơn hàng
                </h1>
                <p className="text-sm text-muted-foreground">
                  #{delivery.orderId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Status Badge */}
        <div className="mb-6">
          <Badge className="bg-green-100 text-green-800 text-base px-4 py-2">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Đã giao thành công
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Restaurant Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-orange-600" />
                  Thông tin nhà hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tên nhà hàng</p>
                  <p className="font-medium">{delivery.restaurantName}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Địa chỉ</p>
                  <p className="font-medium">{delivery.restaurantAddress}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Latitude</p>
                    <p className="font-mono text-sm">{delivery.restaurantLat.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Longitude</p>
                    <p className="font-mono text-sm">{delivery.restaurantLng.toFixed(6)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Thông tin khách hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tên khách hàng</p>
                  <p className="font-medium">{delivery.customerName}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Số điện thoại</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {delivery.customerPhone}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Địa chỉ giao hàng</p>
                  <p className="font-medium">{delivery.customerAddress}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Latitude</p>
                    <p className="font-mono text-sm">{delivery.customerLat.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Longitude</p>
                    <p className="font-mono text-sm">{delivery.customerLng.toFixed(6)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Drone Info */}
            {delivery.drone && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-purple-600" />
                    Thông tin drone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Tên drone</p>
                    <p className="font-medium">{delivery.drone.name}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-medium">{delivery.drone.model}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Serial Number</p>
                    <p className="font-mono text-sm">{delivery.drone.serialNumber}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Pin còn lại</p>
                    <p className="font-medium">{delivery.drone.battery}%</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delivery Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-green-600" />
                  Thông tin giao hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Quãng đường</p>
                  <p className="font-medium">{delivery.distance.toFixed(2)} km</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Thời gian dự kiến</p>
                  <p className="font-medium">{delivery.estimatedTime} phút</p>
                </div>
                {deliveryTime && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Thời gian thực tế</p>
                      <p className="font-medium">{deliveryTime} phút</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Lịch sử giao hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Đơn hàng được tạo</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(delivery.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 rounded-full p-2">
                    <Truck className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Drone được gán</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(delivery.assignedAt)}
                    </p>
                  </div>
                </div>

                {delivery.pickedUpAt && (
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-100 rounded-full p-2">
                      <Package className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Đã lấy hàng</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(delivery.pickedUpAt)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="bg-green-100 rounded-full p-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Đã giao thành công</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(delivery.deliveredAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            onClick={() => navigate("/completed-deliveries")}
          >
            Quay lại danh sách
          </Button>
        </div>
      </main>
    </div>
  );
};

export default CompletedDeliveryDetailPage;

