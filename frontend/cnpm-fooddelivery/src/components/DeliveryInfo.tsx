import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DeliveryInfo = () => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚚 Thông Tin Giao Hàng
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delivery Address */}
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800 mb-2">Địa chỉ giao hàng</h4>
              <p className="text-gray-700">Nguyễn Văn A</p>
              <p className="text-gray-600">0123 456 789</p>
              <p className="text-gray-600">123 Đường ABC, Phường XYZ, Quận 1, TP.HCM</p>
              <Badge variant="secondary" className="mt-2">Địa chỉ mặc định</Badge>
            </div>
            <Button variant="outline" size="sm" className="text-orange-600 border-orange-300">
              Thay đổi
            </Button>
          </div>
        </div>

        {/* Delivery Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">⏰ Thời gian giao hàng</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="deliveryTime" value="now" defaultChecked className="text-orange-500" />
                <span>Giao ngay (25-30 phút)</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="deliveryTime" value="schedule" className="text-orange-500" />
                <span>Đặt trước</span>
              </label>
            </div>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">📋 Ghi chú đơn hàng</h4>
            <textarea
              className="w-full p-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
              placeholder="Ghi chú cho shipper (không bắt buộc)..."
            />
          </div>
        </div>

        {/* Delivery Status */}
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 font-semibold">✅ Khu vực giao hàng</span>
            <Badge className="bg-green-100 text-green-700">Miễn phí ship</Badge>
          </div>
          <p className="text-sm text-green-700">
            Địa chỉ của bạn nằm trong khu vực giao hàng. Dự kiến giao hàng trong 25-30 phút.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryInfo;
