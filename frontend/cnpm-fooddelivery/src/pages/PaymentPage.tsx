import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import PaymentForm from "../components/PaymentForm";
import PaymentSummary from "../components/PaymentSummary";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const PaymentPage = () => {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50">
      <Navigation />

      {/* Header Section */}
      <section className="bg-white shadow-sm">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                💳 Thanh Toán
              </h1>
              <p className="text-gray-600 mt-1">
                Hoàn tất thanh toán để xác nhận đơn hàng
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
                <span>Giỏ hàng</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
                <span>Xác nhận</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className="flex items-center gap-2 text-sm text-orange-600 font-medium">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Thanh toán</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Payment Form */}
          <div className="lg:col-span-2">
            <PaymentForm />

            {/* Terms and Conditions */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms"
                    className="mt-1 text-orange-500"
                    defaultChecked
                  />
                  <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer">
                    Tôi đồng ý với{" "}
                    <a href="#" className="text-orange-600 hover:text-orange-700 underline">
                      Điều khoản sử dụng
                    </a>{" "}
                    và{" "}
                    <a href="#" className="text-orange-600 hover:text-orange-700 underline">
                      Chính sách bảo mật
                    </a>{" "}
                    của FastFood
                  </label>
                </div>
                <div className="mt-3 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="newsletter"
                    className="mt-1 text-orange-500"
                  />
                  <label htmlFor="newsletter" className="text-sm text-gray-700 cursor-pointer">
                    Nhận thông tin khuyến mãi và ưu đãi đặc biệt từ FastFood
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payment Summary & Action */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <PaymentSummary />

              {/* Payment Action */}
              <Card className="mb-4">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <h3 className="font-bold text-orange-800 mb-2">
                        🎉 Ưu đãi đặc biệt!
                      </h3>
                      <p className="text-sm text-orange-700">
                        Giảm ngay 50.000₫ cho đơn hàng đầu tiên
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-orange-600">
                        Tổng: 802.000₫
                      </p>
                      <p className="text-sm text-gray-600">
                        Dự kiến giao: 25-30 phút
                      </p>
                    </div>

                    <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 text-lg">
                      🚀 Thanh Toán Ngay
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      ← Quay lại xác nhận
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Security & Support */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-600">🔒</span>
                      <span className="text-gray-700">Thanh toán an toàn SSL</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-blue-600">💬</span>
                      <span className="text-gray-700">Hỗ trợ 24/7: 1900 1234</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-orange-600">🏆</span>
                      <span className="text-gray-700">Cam kết hoàn tiền 100%</span>
                    </div>
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

export default PaymentPage;
