import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useRestaurantSocket } from "@/contexts/RestaurantSocketContext";
import MerchantLayout from "@/components/MerchantLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Phone, Package, Loader2 } from "lucide-react";
import OtpVerificationDialog from "@/components/OtpVerificationDialog";
import { restaurantOrderService } from "@/services/restaurantOrder.service";
import { toast } from "sonner";

const OrderDetailPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { droneArrivedOrders, isConnected, joinOrder, leaveOrder } = useRestaurantSocket();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  // Join order room để nhận realtime updates
  useEffect(() => {
    if (order?.orderId) {
      console.log('🔌 [OrderDetailPage] Joining order:', order.orderId);
      joinOrder(order.orderId);

      return () => {
        console.log('🔌 [OrderDetailPage] Leaving order:', order.orderId);
        leaveOrder(order.orderId);
      };
    }
  }, [order?.orderId, joinOrder, leaveOrder]);

  const fetchOrderDetail = async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const response = await restaurantOrderService.getMyOrders({ page: 1, limit: 100 });
      if (response.success) {
        const orders = response.data as any[];
        // URL param orderId là restaurantOrderId (DB id), tìm bằng o.id
        const foundOrder = orders.find((o: any) => o.id === orderId);

        console.log('🔍 [OrderDetailPage] Fetching order with orderId:', orderId);
        console.log('📋 [OrderDetailPage] Found order:', foundOrder);

        if (foundOrder) {
          const serverStatus = (foundOrder.restaurantStatus || '').toUpperCase();

          console.log('✅ [OrderDetailPage] Order found:');
          console.log('  - DB id (restaurantOrderId):', foundOrder.id);
          console.log('  - System orderId:', foundOrder.orderId);
          console.log('  - Status:', serverStatus);

          setOrder({
            id: foundOrder.id,
            orderId: foundOrder.orderId, // ✅ Đây là order system ID để match với socket event
            restaurantOrderId: foundOrder.id,
            customerName: foundOrder.customerInfo?.userId || 'Khách hàng',
            phone: foundOrder.customerInfo?.contactPhone || 'N/A',
            address: foundOrder.customerInfo?.deliveryAddress || 'N/A',
            items: (foundOrder.items || []).map((it: any) => ({
              name: it.productName || it.name || 'Item',
              quantity: it.quantity || 1,
              price: it.price || it.productPrice || 0
            })),
            total: foundOrder.totalPrice || 0,
            status: serverStatus === 'PREPARING' ? 'preparing' :
                   serverStatus === 'CONFIRMED' ? 'confirmed' :
                   serverStatus === 'READY_FOR_PICKUP' ? 'ready' :
                   foundOrder.restaurantStatus?.toLowerCase() || 'new',
            createdAt: new Date(foundOrder.receivedAt || foundOrder.confirmedAt).toLocaleString('vi-VN'),
          });

          console.log('✅ [OrderDetailPage] Order state set with orderId:', foundOrder.orderId);

          // ✅ Check if this order already has drone arrived (before mount)
          if (foundOrder.orderId && droneArrivedOrders.has(foundOrder.orderId)) {
            console.log('🚁 [OrderDetailPage] Drone already arrived for this order!');
          }
        } else {
          console.log('❌ [OrderDetailPage] Order not found with id:', orderId);
          console.log('📋 [OrderDetailPage] Available orders:', orders.map(o => ({ id: o.id, orderId: o.orderId })));
          toast.error('Không tìm thấy đơn hàng');
          navigate('/orders');
        }
      }
    } catch (error) {
      console.error('❌ [OrderDetailPage] Error fetching order:', error);
      toast.error('Lỗi khi tải thông tin đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleNotifyReady = async () => {
    if (!order?.restaurantOrderId) return;

    setNotifying(true);
    try {
      const response = await restaurantOrderService.notifyReady(order.restaurantOrderId);
      if (response.success) {
        toast.success('✅ Đã thông báo đội giao hàng thành công!');
        await fetchOrderDetail();
      }
    } catch (error: any) {
      console.error('Error notifying ready:', error);
      toast.error('❌ Lỗi: ' + error.message);
    } finally {
      setNotifying(false);
    }
  };

  const handleOtpSuccess = async () => {
    toast.success('✅ Xác nhận thành công! Drone đang giao hàng.');
    await fetchOrderDetail();
  };

  // Check if drone has arrived for this order
  const droneArrived = order?.orderId && droneArrivedOrders.has(order.orderId);

  // Debug logging
  useEffect(() => {
    console.log('🔍 [OrderDetailPage] State check:');
    console.log('  - order.orderId:', order?.orderId);
    console.log('  - droneArrivedOrders:', Array.from(droneArrivedOrders));
    console.log('  - droneArrived:', droneArrived);
    console.log('  - isConnected:', isConnected);
  }, [order?.orderId, droneArrivedOrders, droneArrived, isConnected]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      new: { label: "Mới", className: "bg-red-500" },
      confirmed: { label: "Đã xác nhận", className: "bg-blue-500" },
      preparing: { label: "Đang chuẩn bị", className: "bg-yellow-500" },
      ready: { label: "Sẵn sàng", className: "bg-green-500" },
      delivering: { label: "Đang giao", className: "bg-purple-500" },
      completed: { label: "Hoàn thành", className: "bg-gray-500" }
    };

    const { label, className } = statusMap[status] || { label: status, className: "bg-gray-400" };
    return <Badge className={className}>{label}</Badge>;
  };

  if (loading) {
    return (
      <MerchantLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MerchantLayout>
    );
  }

  if (!order) {
    return (
      <MerchantLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Không tìm thấy đơn hàng</p>
        </div>
      </MerchantLayout>
    );
  }

  return (
    <MerchantLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/orders')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Chi tiết đơn hàng #{order.id?.toString().slice(-6)}</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">{order.createdAt}</p>
                <span className={`inline-flex items-center gap-1 text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}></span>
                  {isConnected ? 'Real-time' : 'Offline'}
                </span>
              </div>
            </div>
            {getStatusBadge(order.status)}
          </div>

          {/* Customer Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Thông tin khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-semibold">{order.customerName}</p>
                  <p className="text-sm text-gray-600">Tên khách hàng</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-semibold">{order.phone}</p>
                  <p className="text-sm text-gray-600">Số điện thoại</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-500 mt-1" />
                <div>
                  <p className="font-semibold">{order.address}</p>
                  <p className="text-sm text-gray-600">Địa chỉ giao hàng</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Các món ăn</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">Số lượng: x{item.quantity}</p>
                    </div>
                    <span className="font-semibold text-lg text-primary">
                      {item.price.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                <span className="font-bold text-lg">Tổng cộng</span>
                <span className="font-bold text-2xl text-primary">
                  {order.total.toLocaleString("vi-VN")}đ
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Hành động</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Drone arrived - Show OTP button */}
              {droneArrived && order.status === 'preparing' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-medium">
                    <span className="text-2xl">🚁</span>
                    <span>Drone đã đến! Vui lòng xác nhận nhận hàng</span>
                  </div>
                  <Button
                    onClick={() => setShowOtpDialog(true)}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    🔐 Nhập mã OTP để xác nhận
                  </Button>
                </div>
              )}

              {/* Show notify button if preparing and no drone arrived */}
              {order.status === 'preparing' && !droneArrived && (
                <Button
                  onClick={handleNotifyReady}
                  disabled={notifying}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  size="lg"
                >
                  {notifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang thông báo...
                    </>
                  ) : (
                    <>🚚 Thông báo đội giao (Ready)</>
                  )}
                </Button>
              )}

              {/* TEST: Button to test OTP dialog (only for testing) */}
              {import.meta.env.DEV && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-gray-500 mb-2">🧪 Testing tools (dev only):</p>
                  <Button
                    variant="secondary"
                    onClick={() => setShowOtpDialog(true)}
                    size="sm"
                    className="w-full"
                  >
                    Test OTP Dialog
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Drone arrived: {droneArrived ? '✅ Yes' : '❌ No'} |
                    Socket: {isConnected ? '✅ Connected' : '❌ Disconnected'}
                  </p>
                </div>
              )}

              {/* Back button */}
              <Button
                variant="outline"
                onClick={() => navigate('/orders')}
                className="w-full"
                size="lg"
              >
                Quay lại danh sách đơn hàng
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OTP Verification Dialog */}
      <OtpVerificationDialog
        open={showOtpDialog}
        onClose={() => setShowOtpDialog(false)}
        orderId={order.orderId || order.restaurantOrderId}
        onSuccess={handleOtpSuccess}
      />
    </MerchantLayout>
  );
};

export default OrderDetailPage;

