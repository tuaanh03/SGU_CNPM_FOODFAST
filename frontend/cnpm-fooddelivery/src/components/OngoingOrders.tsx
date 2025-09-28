import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Phone, MessageCircle } from "lucide-react";

interface OngoingOrder {
  id: string;
  orderNumber: string;
  restaurant: {
    name: string;
    image: string;
    phone: string;
  };
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  status: "preparing" | "on_the_way" | "delivered";
  estimatedTime: string;
  deliveryAddress: string;
  total: number;
  orderTime: string;
}

const mockOngoingOrders: OngoingOrder[] = [
  {
    id: "1",
    orderNumber: "#ORD-2024-001",
    restaurant: {
      name: "Burger King Việt Nam",
      image: "/burger-restaurant-storefront.png",
      phone: "1900-1234"
    },
    items: [
      { name: "Whopper Burger", quantity: 2, price: 89000 },
      { name: "Coca Cola", quantity: 2, price: 25000 }
    ],
    status: "preparing",
    estimatedTime: "15-20 phút",
    deliveryAddress: "123 Nguyễn Huệ, Q1, TP.HCM",
    total: 228000,
    orderTime: "14:30"
  },
  {
    id: "2",
    orderNumber: "#ORD-2024-002",
    restaurant: {
      name: "Phở Hà Nội",
      image: "/vietnamese-pho-restaurant.png",
      phone: "0901-234-567"
    },
    items: [
      { name: "Phở Bò Tái", quantity: 1, price: 65000 },
      { name: "Trà Đá", quantity: 1, price: 10000 }
    ],
    status: "on_the_way",
    estimatedTime: "5-10 phút",
    deliveryAddress: "456 Lê Lợi, Q1, TP.HCM",
    total: 75000,
    orderTime: "13:45"
  }
];

const statusConfig = {
  preparing: {
    label: "Đang chuẩn bị",
    color: "bg-yellow-100 text-yellow-800",
    icon: "👨‍🍳"
  },
  on_the_way: {
    label: "Đang giao hàng",
    color: "bg-blue-100 text-blue-800",
    icon: "🚚"
  },
  delivered: {
    label: "Đã giao",
    color: "bg-green-100 text-green-800",
    icon: "✅"
  }
};

const OngoingOrders = () => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  if (mockOngoingOrders.length === 0) {
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
      {mockOngoingOrders.map((order) => {
        const status = statusConfig[order.status];

        return (
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
                <Badge className={status.color}>
                  <span className="mr-1">{status.icon}</span>
                  {status.label}
                </Badge>
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

              {/* Delivery Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Thời gian đặt: {order.orderTime}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-primary font-medium">ETA: {order.estimatedTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{order.deliveryAddress}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Phone className="w-4 h-4 mr-2" />
                  Gọi nhà hàng
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Nhắn tin
                </Button>
                {order.status === "on_the_way" && (
                  <Button size="sm" className="flex-1">
                    Theo dõi shipper
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default OngoingOrders;
