import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const PaymentSummary = () => {
  const orderInfo = {
    orderNumber: "#DH20250922001",
    orderDate: "22/09/2025, 09:30",
    estimatedDelivery: "10:00 - 10:30",
    items: [
      { name: "Pizza Pepperoni Đặc Biệt", quantity: 2, price: 598000, image: "🍕" },
      { name: "Burger Bò Phô Mai", quantity: 1, price: 179000, image: "🍔" },
      { name: "Coca Cola", quantity: 2, price: 50000, image: "🥤" }
    ]
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const subtotal = orderInfo.items.reduce((sum, item) => sum + item.price, 0);
  const deliveryFee = 25000;
  const discount = 50000;
  const total = subtotal + deliveryFee - discount;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📋 Chi Tiết Thanh Toán
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Order Info */}
        <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Mã đơn hàng:</span>
              <p className="font-medium text-gray-800">{orderInfo.orderNumber}</p>
            </div>
            <div>
              <span className="text-gray-600">Thời gian đặt:</span>
              <p className="font-medium text-gray-800">{orderInfo.orderDate}</p>
            </div>
            <div className="md:col-span-2">
              <span className="text-gray-600">Dự kiến giao hàng:</span>
              <p className="font-medium text-orange-600">{orderInfo.estimatedDelivery}</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-800 mb-3">Món ăn đã đặt</h4>
          <div className="space-y-2">
            {orderInfo.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.image}</span>
                  <div>
                    <span className="text-sm font-medium text-gray-800">{item.name}</span>
                    <p className="text-xs text-gray-600">Số lượng: {item.quantity}</p>
                  </div>
                </div>
                <span className="font-medium text-orange-600">{formatPrice(item.price)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex justify-between text-gray-600">
            <span>Tạm tính ({orderInfo.items.length} món)</span>
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
          <div className="border-t pt-3 flex justify-between text-lg font-bold">
            <span className="text-gray-800">Tổng thanh toán</span>
            <span className="text-orange-600">{formatPrice(total)}</span>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
            📍 Địa chỉ giao hàng
          </h4>
          <div className="text-sm text-gray-700">
            <p className="font-medium">Nguyễn Văn A</p>
            <p>0123 456 789</p>
            <p>123 Đường ABC, Phường XYZ, Quận 1, TP.HCM</p>
          </div>
          <Badge variant="secondary" className="mt-2">Địa chỉ mặc định</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSummary;
