import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  MapPin,
  Phone,
  CreditCard,
  Package,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { orderService } from "@/services/order.service";
import { paymentService } from "@/services/payment.service";
import { toast } from "sonner";

interface OrderItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
}

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    orderNumber: string;
    items: OrderItem[];
    status: string;
    deliveryAddress: string;
    contactPhone: string;
    total: number;
    orderTime: string;
    expirationTime?: string;
    note?: string;
    createdAt?: string;
  };
}

const OrderDetailDialog = ({ open, onOpenChange, order }: OrderDetailDialogProps) => {
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Cập nhật thời gian mỗi giây cho countdown
  useEffect(() => {
    if (order.status === "pending" && order.expirationTime) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [order.status, order.expirationTime]);

  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    pending: {
      label: "Chờ thanh toán",
      color: "bg-yellow-100 text-yellow-800",
      icon: "⏳",
    },
    processing: {
      label: "Đang xử lý",
      color: "bg-blue-100 text-blue-800",
      icon: "🔄",
    },
    confirmed: {
      label: "Đã xác nhận",
      color: "bg-green-100 text-green-800",
      icon: "✅",
    },
    preparing: {
      label: "Đang chuẩn bị",
      color: "bg-yellow-100 text-yellow-800",
      icon: "👨‍🍳",
    },
    on_the_way: {
      label: "Đang giao hàng",
      color: "bg-blue-100 text-blue-800",
      icon: "🚚",
    },
    success: {
      label: "Hoàn thành",
      color: "bg-green-100 text-green-800",
      icon: "✅",
    },
    completed: {
      label: "Hoàn thành",
      color: "bg-green-100 text-green-800",
      icon: "✅",
    },
    cancelled: {
      label: "Đã hủy",
      color: "bg-red-100 text-red-800",
      icon: "❌",
    },
    failed: {
      label: "Thất bại",
      color: "bg-red-100 text-red-800",
      icon: "❌",
    },
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isExpiringSoon = (expirationTime?: string) => {
    if (!expirationTime) return false;
    const expTime = new Date(expirationTime).getTime();
    const timeLeft = expTime - currentTime;
    return timeLeft > 0 && timeLeft < 5 * 60 * 1000; // Còn dưới 5 phút
  };

  const getTimeLeft = (expirationTime?: string) => {
    if (!expirationTime) return null;
    const expTime = new Date(expirationTime).getTime();
    const timeLeft = Math.max(0, expTime - currentTime);
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes} phút ${seconds} giây`;
    }
    return seconds > 0 ? `${seconds} giây` : "Đã hết hạn";
  };

  const handlePayNow = async () => {
    try {
      setPaymentLoading(true);
      toast.info("Đang khởi tạo thanh toán...");

      // Gọi API retry-payment từ order-service
      const retryResponse = await orderService.retryPayment(order.id);

      if (retryResponse.success) {
        toast.info("Đang lấy thông tin thanh toán...");

        // Sau khi retry payment thành công, poll để lấy payment URL
        const paymentUrlResponse = await paymentService.getPaymentUrl(
          order.id,
          15,
          1000
        );

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
      setPaymentLoading(false);
    }
  };

  const status = statusConfig[order.status] || statusConfig.pending;
  const isPending = order.status === "pending";
  const expiringSoon = isExpiringSoon(order.expirationTime);
  const timeLeft = getTimeLeft(order.expirationTime);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Chi tiết đơn hàng {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Thông tin chi tiết về đơn hàng của bạn
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className={`${status.color} text-base px-4 py-1`}>
              <span className="mr-2">{status.icon}</span>
              {status.label}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {formatDateTime(order.createdAt || order.orderTime)}
            </div>
          </div>

          {/* Warning nếu sắp hết hạn thanh toán - CHỈ CHO PENDING */}
          {isPending && order.expirationTime && (
            <div className={`rounded-lg border p-4 ${expiringSoon ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`w-5 h-5 mt-0.5 ${expiringSoon ? 'text-red-600' : 'text-blue-600'}`} />
                <div className="flex-1">
                  <h4 className={`font-semibold ${expiringSoon ? 'text-red-900' : 'text-blue-900'}`}>
                    {expiringSoon ? "⚠️ Đơn hàng sắp hết hạn!" : "⏰ Thời gian thanh toán"}
                  </h4>
                  <p className={`text-sm ${expiringSoon ? 'text-red-800' : 'text-blue-800'} mt-1`}>
                    Phiên thanh toán còn: <strong>{timeLeft}</strong>
                  </p>
                  <p className={`text-xs ${expiringSoon ? 'text-red-700' : 'text-blue-700'} mt-1`}>
                    Hết hạn lúc: {formatDateTime(order.expirationTime)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Order Items */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Danh sách món</h3>
            </div>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      Số lượng: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatPrice(Number(item.productPrice))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(Number(item.productPrice) * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                <span className="text-lg font-semibold">Tổng cộng</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Delivery Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Thông tin giao hàng</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <MapPin className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Địa chỉ giao hàng
                  </p>
                  <p className="font-medium">{order.deliveryAddress}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Phone className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Số điện thoại liên hệ
                  </p>
                  <p className="font-medium">{order.contactPhone}</p>
                </div>
              </div>

              {order.note && (
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Clock className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Ghi chú
                    </p>
                    <p className="font-medium">{order.note}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Button - CHỈ CHO PENDING */}
          {isPending && (
            <>
              <Separator />
              <Button
                size="lg"
                className="w-full"
                onClick={handlePayNow}
                disabled={paymentLoading}
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Thanh toán ngay
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailDialog;

