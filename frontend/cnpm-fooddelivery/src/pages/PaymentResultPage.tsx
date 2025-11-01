import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, Loader2, Home, Receipt } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const PaymentResultPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  // Lấy thông tin từ URL params
  // Có 2 trường hợp:
  // 1. Từ backend verify (status, orderId, ref, amount)
  // 2. Từ VNPay trực tiếp (vnp_ResponseCode, vnp_TxnRef, vnp_Amount, vnp_OrderInfo, ...)

  let status = searchParams.get("status"); // success, failed, error
  let orderId = searchParams.get("orderId");
  let ref = searchParams.get("ref"); // transaction reference
  let amount = searchParams.get("amount");
  const errorMessage = searchParams.get("message") || searchParams.get("error");

  // Nếu có vnp_ResponseCode, nghĩa là VNPay redirect trực tiếp (direct mode)
  const vnp_ResponseCode = searchParams.get("vnp_ResponseCode");
  const vnp_TxnRef = searchParams.get("vnp_TxnRef");
  const vnp_Amount = searchParams.get("vnp_Amount");
  const vnp_OrderInfo = searchParams.get("vnp_OrderInfo");

  if (vnp_ResponseCode) {
    // Parse từ VNPay params
    status = vnp_ResponseCode === "00" ? "success" : "failed";
    ref = vnp_TxnRef || ref;
    amount = vnp_Amount ? (Number(vnp_Amount) / 100).toString() : amount;

    // Extract orderId từ vnp_OrderInfo (format: "Order {orderId} - ...")
    if (vnp_OrderInfo && !orderId) {
      const match = vnp_OrderInfo.match(/Order\s+([a-f0-9-]+)/);
      orderId = match ? match[1] : orderId;
    }
  }

  useEffect(() => {
    // Simulate loading để có hiệu ứng đẹp hơn
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Format số tiền
  const formatPrice = (price: string | null) => {
    if (!price) return "0 ₫";
    const numPrice = parseFloat(price);
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(numPrice);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Đang xử lý kết quả thanh toán...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render success state
  if (status === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">
              Thanh toán thành công!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Đơn hàng của bạn đã được thanh toán thành công. Cảm ơn bạn đã sử dụng dịch vụ!
            </p>

            <Separator />

            {/* Thông tin giao dịch */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                THÔNG TIN GIAO DỊCH
              </h3>

              {orderId && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Mã đơn hàng:</span>
                  <span className="text-sm font-medium">{orderId}</span>
                </div>
              )}

              {ref && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Mã giao dịch:</span>
                  <span className="text-sm font-medium">{ref}</span>
                </div>
              )}

              {amount && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Số tiền:</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatPrice(amount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Trạng thái:</span>
                <span className="text-sm font-medium text-green-600">
                  Thành công
                </span>
              </div>
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="space-y-2">
              <Button
                onClick={() => navigate("/my-orders")}
                className="w-full"
                size="lg"
              >
                <Receipt className="mr-2 h-4 w-4" />
                Xem đơn hàng của tôi
              </Button>

              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Home className="mr-2 h-4 w-4" />
                Về trang chủ
              </Button>
            </div>

            {/* Additional info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Lưu ý:</strong> Đơn hàng của bạn sẽ được xử lý trong vòng 5-10 phút.
                Bạn có thể theo dõi trạng thái đơn hàng trong mục "Đơn hàng của tôi".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render failed state
  if (status === "failed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 p-3">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">
              Thanh toán thất bại
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Rất tiếc, giao dịch thanh toán của bạn không thành công. Vui lòng thử lại.
            </p>

            <Separator />

            {/* Thông tin giao dịch */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                THÔNG TIN GIAO DỊCH
              </h3>

              {orderId && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Mã đơn hàng:</span>
                  <span className="text-sm font-medium">{orderId}</span>
                </div>
              )}

              {ref && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Mã giao dịch:</span>
                  <span className="text-sm font-medium">{ref}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Trạng thái:</span>
                <span className="text-sm font-medium text-red-600">
                  Thất bại
                </span>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-800">
                    <strong>Lỗi:</strong> {errorMessage}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="space-y-2">
              <Button
                onClick={() => navigate("/my-orders")}
                className="w-full"
                size="lg"
              >
                <Receipt className="mr-2 h-4 w-4" />
                Thử thanh toán lại
              </Button>

              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Home className="mr-2 h-4 w-4" />
                Về trang chủ
              </Button>
            </div>

            {/* Additional info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>Gợi ý:</strong> Hãy kiểm tra lại số dư tài khoản và thông tin thẻ.
                Nếu vấn đề vẫn tiếp tục, vui lòng liên hệ ngân hàng hoặc bộ phận hỗ trợ.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render error state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-orange-100 p-3">
              <AlertCircle className="h-12 w-12 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-orange-600">
            Có lỗi xảy ra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Đã có lỗi xảy ra trong quá trình xử lý thanh toán. Vui lòng thử lại sau.
          </p>

          {errorMessage && (
            <div className="bg-orange-50 border border-orange-200 rounded p-3">
              <p className="text-sm text-orange-800">
                <strong>Chi tiết lỗi:</strong> {errorMessage}
              </p>
            </div>
          )}

          <Separator />

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              onClick={() => navigate("/my-orders")}
              className="w-full"
              size="lg"
            >
              <Receipt className="mr-2 h-4 w-4" />
              Xem đơn hàng của tôi
            </Button>

            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Home className="mr-2 h-4 w-4" />
              Về trang chủ
            </Button>
          </div>

          {/* Additional info */}
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-700">
              <strong>Liên hệ hỗ trợ:</strong> Nếu bạn cần trợ giúp, vui lòng liên hệ
              hotline <strong>1900 1234</strong> hoặc email <strong>support@fooddelivery.vn</strong>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentResultPage;

