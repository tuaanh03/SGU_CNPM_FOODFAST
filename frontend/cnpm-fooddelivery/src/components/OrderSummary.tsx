import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const OrderSummary = () => {
  const orderItems = [
    {
      id: 1,
      name: "Pizza Pepperoni Đặc Biệt",
      quantity: 2,
      price: 299000,
      image: "🍕",
      note: "Không hành"
    },
    {
      id: 2,
      name: "Burger Bò Phô Mai",
      quantity: 1,
      price: 179000,
      image: "🍔",
      note: ""
    },
    {
      id: 3,
      name: "Coca Cola",
      quantity: 2,
      price: 25000,
      image: "🥤",
      note: ""
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 25000;
  const discount = 50000;
  const total = subtotal + deliveryFee - discount;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🛍️ Tóm Tắt Đơn Hàng
          <Badge variant="secondary">{orderItems.length} món</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Order Items */}
          {orderItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.image}</span>
                <div>
                  <h4 className="font-medium text-gray-800">{item.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Số lượng: {item.quantity}</span>
                    {item.note && (
                      <Badge variant="outline" className="text-xs">
                        Ghi chú: {item.note}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-orange-600">
                  {formatPrice(item.price * item.quantity)}
                </p>
                <p className="text-sm text-gray-500">
                  {formatPrice(item.price)}/món
                </p>
              </div>
            </div>
          ))}

          {/* Price Breakdown */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Tạm tính</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Phí giao hàng</span>
              <span>{formatPrice(deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Giảm giá</span>
              <span>-{formatPrice(discount)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-lg font-bold text-gray-800">
              <span>Tổng cộng</span>
              <span className="text-orange-600">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderSummary;
