import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OrderSummary from "@/components/OrderSummary";
import DeliveryInfo from "@/components/DeliveryInfo";
import PaymentMethod from "@/components/PaymentMethod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const OrderPage = () => {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50">
      <Navigation />

      {/* Header Section */}
      <section className="bg-white shadow-sm">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                🛒 Xác Nhận Đơn Hàng
              </h1>
              <p className="text-gray-600 mt-1">
                Kiểm tra thông tin và hoàn tất đặt hàng
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
                <span>Giỏ hàng</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className="flex items-center gap-2 text-sm text-orange-600 font-medium">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                <span>Xác nhận</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-6 h-6 bg-gray-300 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Thanh toán</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            <OrderSummary />
            <DeliveryInfo />
            <PaymentMethod />
          </div>

          {/* Right Column - Order Summary & Actions */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card className="mb-4">
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    📊 Thông Tin Đơn Hàng
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mã đơn hàng:</span>
                      <span className="font-medium">#DH20250922001</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Thời gian đặt:</span>
                      <span className="font-medium">09:30, 22/09/2025</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Dự kiến giao:</span>
                      <span className="font-medium text-orange-600">10:00 - 10:30</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tổng tiền:</span>
                      <span className="font-bold text-xl text-orange-600">673.000₫</span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3">
                      🚀 Xác Nhận Đặt Hàng
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      ← Quay lại giỏ hàng
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Help Section */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    💬 Cần hỗ trợ?
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2">
                      <span>📞</span>
                      <span>Hotline: 1900 1234</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span>💬</span>
                      <span>Chat với CSKH</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span>⏰</span>
                      <span>Hỗ trợ 24/7</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderPage;
