import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, RotateCcw, Eye, Calendar, Loader2 } from "lucide-react";
import { orderService } from "@/services/order.service";
import { toast } from "sonner";
import OrderDetailDialog from "./OrderDetailDialog";

interface HistoryOrder {
  id: string;
  orderNumber: string;
  items: {
    productId: string;
    productName: string;
    productPrice: number;
    quantity: number;
  }[];
  status: string;
  orderDate: string;
  deliveryTime?: string;
  total: number;
  rating?: number;
  reviewed?: boolean;
  deliveryAddress?: string;
  contactPhone?: string;
  note?: string;
}

const OrderHistory = () => {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "cancelled">("all");
  const [selectedOrder, setSelectedOrder] = useState<HistoryOrder | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    loadOrderHistory();
  }, []);

  const loadOrderHistory = async () => {
    try {
      setLoading(true);
      const response = await orderService.getMyOrders();

      if (response.success) {
        // Lọc chỉ lấy đơn hàng đã hoàn thành hoặc đã hủy
        const historyOrders = response.data.filter((order: any) =>
          order.status === "success" ||
          order.status === "completed" ||
          order.status === "cancelled" ||
          order.status === "failed"
        );

        setOrders(historyOrders.map((order: any) => ({
          id: order.id,
          orderNumber: `#${order.id.slice(0, 8)}`,
          items: order.items || [],
          status: order.status,
          orderDate: order.createdAt,
          total: Number(order.totalPrice),
          reviewed: false,
          deliveryAddress: order.deliveryAddress || "Không có thông tin",
          contactPhone: order.contactPhone || "Không có thông tin",
          note: order.note
        })));
      }
    } catch (error: any) {
      console.error("Error loading order history:", error);
      toast.error("Không thể tải lịch sử đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredOrders = orders.filter(order => {
    if (filter === "all") return true;
    if (filter === "success") return order.status === "success" || order.status === "completed";
    if (filter === "cancelled") return order.status === "cancelled" || order.status === "failed";
    return true;
  });

  const handleViewDetail = (order: HistoryOrder) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Tất cả ({orders.length})
        </Button>
        <Button
          variant={filter === "success" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("success")}
        >
          Hoàn thành ({orders.filter(o => o.status === "success" || o.status === "completed").length})
        </Button>
        <Button
          variant={filter === "cancelled" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("cancelled")}
        >
          Đã hủy ({orders.filter(o => o.status === "cancelled" || o.status === "failed").length})
        </Button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Không có đơn hàng {filter === "all" ? "" : filter === "success" ? "hoàn thành" : "đã hủy"}
          </h3>
          <p className="text-muted-foreground">
            {filter === "all"
              ? "Bạn chưa có đơn hàng nào"
              : `Không có đơn hàng ${filter === "success" ? "hoàn thành" : "đã hủy"} nào`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isCompleted = order.status === "success" || order.status === "completed";

            return (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-lg">Đơn hàng {order.orderNumber}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {order.items.length} món
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={
                          isCompleted
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {isCompleted ? "✅ Hoàn thành" : "❌ Đã hủy"}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(order.orderDate)}
                      </div>
                    </div>
                  </div>
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

                  {/* Order Info */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex justify-between items-center text-sm">
                      <span>
                        {isCompleted ? "Đã giao hàng thành công" : "Đơn hàng đã bị hủy"}
                      </span>
                      {order.rating && (
                        <div className="flex items-center gap-2">
                          <span>Đánh giá:</span>
                          {renderStars(order.rating)}
                        </div>
                      )}
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

                    {isCompleted && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Đặt lại
                        </Button>

                        {!order.reviewed && (
                          <Button size="sm" className="flex-1">
                            <Star className="w-4 h-4 mr-2" />
                            Đánh giá
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Order Detail Dialog */}
      {selectedOrder && (
        <OrderDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          order={{
            ...selectedOrder,
            orderTime: formatDate(selectedOrder.orderDate),
            createdAt: selectedOrder.orderDate,
            deliveryAddress: selectedOrder.deliveryAddress || "Không có thông tin",
            contactPhone: selectedOrder.contactPhone || "Không có thông tin"
          }}
        />
      )}
    </div>
  );
};

export default OrderHistory;
