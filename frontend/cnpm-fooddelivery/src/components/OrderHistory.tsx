import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, RotateCcw, Eye, Calendar } from "lucide-react";
import { useState } from "react";

interface HistoryOrder {
  id: string;
  orderNumber: string;
  restaurant: {
    name: string;
    image: string;
  };
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  status: "completed" | "cancelled";
  orderDate: string;
  deliveryTime: string;
  total: number;
  rating?: number;
  reviewed: boolean;
}

const mockOrderHistory: HistoryOrder[] = [
  {
    id: "1",
    orderNumber: "#ORD-2024-100",
    restaurant: {
      name: "Pizza Hut",
      image: "/pizza-restaurant-interior.png"
    },
    items: [
      { name: "Pizza Hải Sản", quantity: 1, price: 299000 },
      { name: "Pepsi", quantity: 2, price: 30000 }
    ],
    status: "completed",
    orderDate: "2024-01-15",
    deliveryTime: "25 phút",
    total: 359000,
    rating: 5,
    reviewed: true
  },
  {
    id: "2",
    orderNumber: "#ORD-2024-099",
    restaurant: {
      name: "Sushi Tokyo",
      image: "/japanese-sushi-restaurant.png"
    },
    items: [
      { name: "Combo Sushi 20 miếng", quantity: 1, price: 450000 },
      { name: "Trà xanh", quantity: 1, price: 25000 }
    ],
    status: "completed",
    orderDate: "2024-01-12",
    deliveryTime: "35 phút",
    total: 475000,
    rating: 4,
    reviewed: true
  },
  {
    id: "3",
    orderNumber: "#ORD-2024-098",
    restaurant: {
      name: "Trà Sữa Gong Cha",
      image: "/bubble-tea-shop-modern.jpg"
    },
    items: [
      { name: "Trà Sữa Trân Châu", quantity: 2, price: 55000 },
      { name: "Bánh Flan", quantity: 1, price: 35000 }
    ],
    status: "cancelled",
    orderDate: "2024-01-10",
    deliveryTime: "N/A",
    total: 145000,
    reviewed: false
  },
  {
    id: "4",
    orderNumber: "#ORD-2024-097",
    restaurant: {
      name: "Bánh Mì Hội An",
      image: "/vietnamese-banh-mi-sandwich-shop.jpg"
    },
    items: [
      { name: "Bánh Mì Thịt Nướng", quantity: 3, price: 25000 },
      { name: "Cà phê sữa đá", quantity: 1, price: 18000 }
    ],
    status: "completed",
    orderDate: "2024-01-08",
    deliveryTime: "15 phút",
    total: 93000,
    reviewed: false
  }
];

const OrderHistory = () => {
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");

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
      year: 'numeric'
    });
  };

  const filteredOrders = mockOrderHistory.filter(order => {
    if (filter === "all") return true;
    return order.status === filter;
  });

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

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Tất cả ({mockOrderHistory.length})
        </Button>
        <Button
          variant={filter === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("completed")}
        >
          Hoàn thành ({mockOrderHistory.filter(o => o.status === "completed").length})
        </Button>
        <Button
          variant={filter === "cancelled" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("cancelled")}
        >
          Đã hủy ({mockOrderHistory.filter(o => o.status === "cancelled").length})
        </Button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Không có đơn hàng {filter === "all" ? "" : filter === "completed" ? "hoàn thành" : "đã hủy"}
          </h3>
          <p className="text-muted-foreground">
            {filter === "all"
              ? "Bạn chưa có đơn hàng nào"
              : `Không có đơn hàng ${filter === "completed" ? "hoàn thành" : "đã hủy"} nào`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={order.restaurant.image}
                      alt={order.restaurant.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <CardTitle className="text-lg">{order.restaurant.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      className={
                        order.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {order.status === "completed" ? "✅ Hoàn thành" : "❌ Đã hủy"}
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
                      <span>{item.quantity}x {item.name}</span>
                      <span className="font-medium">{formatPrice(item.price)}</span>
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
                    <span>Thời gian giao hàng: <strong>{order.deliveryTime}</strong></span>
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
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="w-4 h-4 mr-2" />
                    Xem chi tiết
                  </Button>

                  {order.status === "completed" && (
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
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
