import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  LogOut,
  CheckCircle2,
  Package,
  MapPin,
  User,
  Calendar,
  Search,
  Eye,
  Truck
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { deliveryService } from "@/services/delivery.service";
import { toast } from "sonner";

interface CompletedDelivery {
  id: string;
  orderId: string;
  droneId: string;
  restaurantName: string;
  restaurantAddress: string;
  customerName: string;
  customerAddress: string;
  distance: number;
  status: string;
  deliveredAt: string;
  createdAt: string;
  drone?: {
    name: string;
    model: string;
  };
}

const CompletedDeliveriesPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [deliveries, setDeliveries] = useState<CompletedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredDeliveries, setFilteredDeliveries] = useState<CompletedDelivery[]>([]);

  useEffect(() => {
    fetchCompletedDeliveries();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = deliveries.filter((delivery) =>
        delivery.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDeliveries(filtered);
    } else {
      setFilteredDeliveries(deliveries);
    }
  }, [searchTerm, deliveries]);

  const fetchCompletedDeliveries = async () => {
    try {
      setLoading(true);
      const response = await deliveryService.getAllDeliveries({
        status: 'DELIVERED'
      });

      if (response.success) {
        setDeliveries(response.data);
        setFilteredDeliveries(response.data);
      }
    } catch (error) {
      console.error('Error fetching completed deliveries:', error);
      toast.error('Không thể tải danh sách đơn hàng đã giao');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleViewDetail = (delivery: CompletedDelivery) => {
    navigate(`/completed-deliveries/${delivery.orderId}`);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: vi });
    } catch {
      return dateString;
    }
  };

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
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Đơn hàng đã giao
                </h1>
                <p className="text-sm text-muted-foreground">
                  Quản lý và theo dõi các đơn hàng đã hoàn thành
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

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Tổng đơn đã giao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deliveries.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                Hôm nay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deliveries.filter(d => {
                  const today = new Date();
                  const deliveredDate = new Date(d.deliveredAt);
                  return deliveredDate.toDateString() === today.toDateString();
                }).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-600" />
                Tổng quãng đường
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deliveries.reduce((sum, d) => sum + d.distance, 0).toFixed(1)} km
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm theo mã đơn, nhà hàng, khách hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Deliveries List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Đang tải dữ liệu...</p>
            </div>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? "Không tìm thấy đơn hàng nào" : "Chưa có đơn hàng đã giao"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredDeliveries.map((delivery) => (
              <Card key={delivery.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side - Main info */}
                    <div className="flex-1 space-y-3">
                      {/* Order ID and Status */}
                      <div className="flex items-center gap-3">
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Đã giao
                        </Badge>
                        <span className="text-sm font-mono text-muted-foreground">
                          #{delivery.orderId.slice(0, 8).toUpperCase()}
                        </span>
                      </div>

                      {/* Restaurant and Customer */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{delivery.restaurantName}</p>
                              <p className="text-xs text-muted-foreground">
                                {delivery.restaurantAddress}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{delivery.customerName}</p>
                              <p className="text-xs text-muted-foreground">
                                {delivery.customerAddress}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Delivery info */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {delivery.drone && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">Drone:</span>
                            {delivery.drone.name}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-foreground">Quãng đường:</span>
                          {delivery.distance.toFixed(2)} km
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(delivery.deliveredAt)}
                        </div>
                      </div>
                    </div>

                    {/* Right side - Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleViewDetail(delivery)}
                        className="gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Chi tiết
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary */}
        {filteredDeliveries.length > 0 && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="text-center text-sm text-muted-foreground">
                Hiển thị {filteredDeliveries.length} đơn hàng đã giao
                {searchTerm && ` (lọc từ ${deliveries.length} đơn)`}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default CompletedDeliveriesPage;

