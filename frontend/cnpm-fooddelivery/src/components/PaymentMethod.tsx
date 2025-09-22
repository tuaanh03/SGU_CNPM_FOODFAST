import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PaymentMethod = () => {
  const paymentMethods = [
    {
      id: "cash",
      name: "Thanh toán khi nhận hàng",
      icon: "💵",
      description: "Thanh toán bằng tiền mặt khi shipper giao hàng",
      isRecommended: true
    },
    {
      id: "momo",
      name: "Ví MoMo",
      icon: "📱",
      description: "Thanh toán qua ví điện tử MoMo",
      isRecommended: false
    },
    {
      id: "zalopay",
      name: "ZaloPay",
      icon: "💳",
      description: "Thanh toán qua ví ZaloPay",
      isRecommended: false
    },
    {
      id: "bank",
      name: "Chuyển khoản ngân hàng",
      icon: "🏦",
      description: "Chuyển khoản qua Internet Banking",
      isRecommended: false
    }
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          💳 Phương Thức Thanh Toán
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors cursor-pointer"
            >
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  defaultChecked={method.id === "cash"}
                  className="text-orange-500"
                />
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{method.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-800">{method.name}</h4>
                      {method.isRecommended && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">
                          Khuyến nghị
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>

        {/* Payment Security */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">🔒</span>
            <p className="text-sm text-blue-700">
              Thông tin thanh toán của bạn được bảo mật tuyệt đối
            </p>
          </div>
        </div>

        {/* Voucher Section */}
        <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
            🎫 Mã giảm giá
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nhập mã giảm giá"
              className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50">
              Áp dụng
            </Button>
          </div>
          <div className="mt-2">
            <Badge variant="secondary" className="mr-2">FREESHIP</Badge>
            <Badge variant="secondary">SAVE20K</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentMethod;
