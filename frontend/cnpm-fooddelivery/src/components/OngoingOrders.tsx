import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Phone, Loader2, CreditCard, Eye, Wifi } from "lucide-react";
import { orderService } from "@/services/order.service";
import { paymentService } from "@/services/payment.service";
import { toast } from "sonner";
import OrderDetailDialog from "./OrderDetailDialog";
import { useCustomerSocket } from "@/contexts/CustomerSocketContext";

interface OngoingOrder {
  id: string;
  orderNumber: string;
  restaurant: {
    name: string;
    image: string;
    phone: string;
  };
  items: {
    productId: string;
    productName: string;
    productPrice: number;
    quantity: number;
  }[];
  status: string;
  estimatedTime?: string;
  deliveryAddress: string;
  contactPhone: string;
  total: number;
  orderTime: string;
  expirationTime?: string;
}

const OngoingOrders = () => {
  const [orders, setOrders] = useState<OngoingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OngoingOrder | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Use CustomerSocketContext for realtime updates
  const { orderStatuses, joinOrder, leaveOrder, isConnected } = useCustomerSocket();

  useEffect(() => {
    loadOngoingOrders();
  }, []);

  // Join order rooms khi có orders - track orderId list để tránh re-join liên tục
  useEffect(() => {
    if (orders.length === 0) return;

    const activeOrders = orders.filter(o =>
      o.status === "confirmed" ||
      o.status === "preparing" ||
      o.status === "processing" ||
      o.status === "ready"
    );

    console.log('🔌 [OngoingOrders] Joining order rooms for', activeOrders.length, 'active orders');

    activeOrders.forEach(order => {
      console.log('📢 [OngoingOrders] Joining order room:', order.id);
      joinOrder(order.id);
    });

    return () => {
      activeOrders.forEach(order => {
        console.log('📢 [OngoingOrders] Leaving order room:', order.id);
        leaveOrder(order.id);
      });
    };
  }, [orders.map(o => o.id).join(',')]); // Depend on order IDs to avoid re-joining

  // Xử lý cập nhật trạng thái từ socket
  useEffect(() => {
    // orderStatuses là Record<orderId, status>
    Object.entries(orderStatuses).forEach(([orderId, status]) => {
      console.log('📦 [OngoingOrders] Order status updated from socket:', { orderId, status });

      // Cập nhật status trong danh sách orders
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, status: mapRestaurantStatusToOrderStatus(status) }
            : order
        )
      );

      // Show toast notification (chỉ lần đầu tiên)
      const statusText = getStatusText(status);
      toast.info(`📦 Đơn hàng: ${statusText}`);
    });
  }, [orderStatuses]);

  // Helper: Map restaurant status to order status
  const mapRestaurantStatusToOrderStatus = (restaurantStatus: string): string => {
    const statusMap: Record<string, string> = {
      'CONFIRMED': 'confirmed',
      'PREPARING': 'preparing',
      'READY_FOR_PICKUP': 'ready',
      'READY': 'ready',
      'PICKED_UP': 'delivering',
      'DELIVERING': 'delivering',
      'DELIVERED': 'completed',
      'COMPLETED': 'completed',
    };
    return statusMap[restaurantStatus] || restaurantStatus.toLowerCase();
  };

  // Helper: Get readable status text
  const getStatusText = (restaurantStatus: string): string => {
    const textMap: Record<string, string> = {
      'CONFIRMED': 'Đã xác nhận',
      'PREPARING': 'Đang chuẩn bị',
      'READY_FOR_PICKUP': 'Sẵn sàng giao',
      'READY': 'Sẵn sàng giao',
      'PICKED_UP': 'Đang giao hàng',
      'DELIVERING': 'Đang giao hàng',
      'DELIVERED': 'Hoàn thành',
      'COMPLETED': 'Hoàn thành',
    };
    return textMap[restaurantStatus] || restaurantStatus;
  };

  const loadOngoingOrders = async () => {
    try {
      setLoading(true);
      const response = await orderService.getMyOrders();

      if (response.success) {
        // Lọc chỉ lấy đơn hàng đang xử lý (chưa hoàn thành và chưa hủy)
        const ongoingOrders = response.data.filter((order: any) =>
          order.status === "pending" ||
          order.status === "processing" ||
          order.status === "confirmed" ||
          order.status === "preparing" ||
          order.status === "ready" ||
          order.status === "readyForPickup" ||
          order.status === "delivering"
        );

        setOrders(ongoingOrders.map((order: any) => ({
          id: order.id,
          orderNumber: `#${order.id.slice(0, 8)}`,
          restaurant: {
            name: order.items[0]?.productName || "Nhà hàng",
            image: "/burger-restaurant-storefront.png", // Default image
            phone: "1900-1234"
          },
          items: order.items || [],
          status: order.status,
          deliveryAddress: order.deliveryAddress,
          contactPhone: order.contactPhone,
          total: Number(order.totalPrice),
          orderTime: new Date(order.createdAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit"
          }),
          expirationTime: order.expirationTime
        })));
      }
    } catch (error: any) {
      console.error("Error loading ongoing orders:", error);
      toast.error("Không thể tải đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async (orderId: string) => {
    try {
      setPaymentLoading(orderId);
      toast.info("Đang khởi tạo thanh toán...");

      // Gọi API retry-payment từ order-service
      const retryResponse = await orderService.retryPayment(orderId);

      if (retryResponse.success) {
        toast.info("Đang lấy thông tin thanh toán...");

        // Sau khi retry payment thành công, poll để lấy payment URL
        const paymentUrlResponse = await paymentService.getPaymentUrl(orderId, 15, 1000);

        if (paymentUrlResponse.success && paymentUrlResponse.paymentUrl) {
          toast.success("Đang chuyển đến trang thanh toán...");
          window.location.href = paymentUrlResponse.paymentUrl;
        } else {
          toast.error("Không thể lấy thông tin thanh toán");
        }
      } else {
        toast.error(retryResponse.message || "Không thể khởi tạo thanh toán");
      }
    } catch (error: any) {
      console.error("Error retrying payment:", error);
      toast.error(error.message || "Có lỗi xảy ra khi khởi tạo thanh toán");
    } finally {
      setPaymentLoading(null);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    pending: {
      label: "Chờ thanh toán",
      color: "bg-yellow-100 text-yellow-800",
      icon: "⏳"
    },
    processing: {
      label: "Đang xử lý",
      color: "bg-blue-100 text-blue-800",
      icon: "🔄"
    },
    confirmed: {
      label: "Đã xác nhận",
      color: "bg-green-100 text-green-800",
      icon: "✅"
    },
    preparing: {
      label: "Đang chuẩn bị",
      color: "bg-orange-100 text-orange-800",
      icon: "👨‍🍳"
    },
    ready: {
      label: "Sẵn sàng giao",
      color: "bg-blue-100 text-blue-800",
      icon: "📦"
    },
    delivering: {
      label: "Đang giao hàng",
      color: "bg-purple-100 text-purple-800",
      icon: "🚚"
    },
    on_the_way: {
      label: "Đang giao hàng",
      color: "bg-blue-100 text-blue-800",
      icon: "🚚"
    },
    completed: {
      label: "Hoàn thành",
      color: "bg-gray-100 text-gray-800",
      icon: "✓"
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const isExpiringSoon = (expirationTime?: string) => {
    if (!expirationTime) return false;
    const expTime = new Date(expirationTime).getTime();
    const now = Date.now();
    const timeLeft = expTime - now;
    return timeLeft > 0 && timeLeft < 5 * 60 * 1000; // Còn dưới 5 phút
  };

  const getTimeLeft = (expirationTime?: string) => {
    if (!expirationTime) return null;
    const expTime = new Date(expirationTime).getTime();
    const now = Date.now();
    const timeLeft = Math.max(0, expTime - now);
    const minutes = Math.floor(timeLeft / 60000);
    return minutes > 0 ? `${minutes} phút` : "Sắp hết hạn";
  };

  const handleViewDetail = (order: OngoingOrder) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Không có đơn hàng đang xử lý</h3>
        <p className="text-muted-foreground">Đặt món ngay để thưởng thức những món ăn ngon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const status = statusConfig[order.status] || statusConfig.pending;
        const expiringSoon = isExpiringSoon(order.expirationTime);
        const timeLeft = getTimeLeft(order.expirationTime);

        return (
          <Card key={order.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Đơn hàng {order.orderNumber}</CardTitle>
                      {/* Real-time tracking indicator */}
                      {isConnected && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <Wifi className="w-3 h-3 mr-1" />
                          Live
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.items.length} món • {order.orderTime}
                    </p>
                  </div>
                </div>
                <Badge className={status.color}>
                  <span className="mr-1">{status.icon}</span>
                  {status.label}
                </Badge>
              </div>

              {/* Warning nếu sắp hết hạn thanh toán */}
              {order.status === "pending" && expiringSoon && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                  <p className="text-xs text-red-800">
                    ⚠️ <strong>Đơn hàng sắp hết hạn!</strong> Còn {timeLeft} để thanh toán
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Order Items */}
              <div className="space-y-2">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.productName}</span>
                    <span className="font-medium">{formatPrice(Number(item.productPrice))}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Tổng cộng</span>
                  <span className="text-primary">{formatPrice(order.total)}</span>
                </div>
              </div>

              {/* Delivery Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Thời gian đặt: {order.orderTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{order.deliveryAddress}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewDetail(order)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Xem chi tiết
                </Button>

                {order.status === "pending" ? (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePayNow(order.id)}
                    disabled={paymentLoading === order.id}
                  >
                    {paymentLoading === order.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Thanh toán ngay
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Phone className="w-4 h-4 mr-2" />
                      {order.contactPhone}
                    </Button>
                    {order.status === "confirmed" && (
                      <Button size="sm" className="flex-1">
                        Theo dõi đơn hàng
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Order Detail Dialog */}
      {selectedOrder && (
        <OrderDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          order={selectedOrder}
        />
      )}
    </div>
  );
};

export default OngoingOrders;
