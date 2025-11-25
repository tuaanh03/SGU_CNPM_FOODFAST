import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useCart } from "@/contexts/cart-context";
import { useAddress } from "@/contexts/address-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Phone, Store, ShoppingBag, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "@/services/order.service";
import { paymentService } from "@/services/payment.service";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { state, formatPrice } = useCart();
  const { selectedAddress } = useAddress();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    note: "",
  });

  // Validate giỏ hàng và địa chỉ
  useEffect(() => {
    if (state.items.length === 0) {
      toast.error("Giỏ hàng của bạn đang trống");
      navigate("/");
      return;
    }

    if (!selectedAddress) {
      toast.error("Vui lòng chọn địa chỉ giao hàng từ header");
      navigate("/");
      return;
    }

    if (!state.restaurant) {
      toast.error("Vui lòng chọn nhà hàng trước khi thanh toán");
      navigate("/");
      return;
    }
  }, [state.items.length, selectedAddress, state.restaurant, navigate]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePlaceOrder = async () => {
    if (!state.restaurant) {
      toast.error("Không tìm thấy thông tin nhà hàng");
      return;
    }

    if (!selectedAddress) {
      toast.error("Vui lòng chọn địa chỉ giao hàng");
      return;
    }

    // Kiểm tra đăng nhập
    const token = localStorage.getItem("customer_token");
    if (!token) {
      toast.error("Vui lòng đăng nhập để đặt hàng");
      navigate("/login");
      return;
    }

    setLoading(true);
    try {
      const storeId = state.restaurant.id;
      const deliveryAddressText = `${selectedAddress.address}, ${selectedAddress.ward}, ${selectedAddress.district}, ${selectedAddress.province}`;

      console.log("📦 Creating order for store:", storeId);
      console.log("📍 Delivery address:", {
        address: deliveryAddressText,
        lat: selectedAddress.latitude,
        lng: selectedAddress.longitude,
      });

      // Bước 1: Tạo order từ cart qua API Gateway
      const response = await orderService.createOrderFromCart({
        storeId: storeId,
        deliveryAddress: deliveryAddressText,
        contactPhone: selectedAddress.phone,
        note: formData.note || undefined,
        customerLatitude: selectedAddress.latitude,
        customerLongitude: selectedAddress.longitude,
      });

      if (response.success) {
        const orderId = response.data.orderId;
        toast.success("Đặt hàng thành công! Đang lấy thông tin thanh toán...");

        // Bước 2: Poll để lấy payment URL từ Payment Service
        try {
          const paymentUrlResponse = await paymentService.getPaymentUrl(orderId, 15, 1000);

          if (paymentUrlResponse.success && paymentUrlResponse.paymentUrl) {
            toast.success("Đang chuyển đến trang thanh toán VNPay...");

            // Redirect đến VNPay payment URL
            window.location.href = paymentUrlResponse.paymentUrl;
          } else if (paymentUrlResponse.status === "SUCCEEDED") {
            toast.success("Đơn hàng đã được thanh toán thành công!");
            navigate("/my-orders");
          } else {
            throw new Error(paymentUrlResponse.message || "Không thể lấy thông tin thanh toán");
          }
        } catch (paymentError: any) {
          console.error("Error getting payment URL:", paymentError);
          toast.error(paymentError.message || "Không thể lấy thông tin thanh toán. Vui lòng xem đơn hàng trong mục 'Đơn hàng của tôi'");

          // Vẫn chuyển đến my-orders để user có thể retry payment
          setTimeout(() => {
            navigate("/my-orders");
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error("Error placing order:", error);
      toast.error(error.message || "Có lỗi xảy ra khi đặt hàng");
    } finally {
      setLoading(false);
    }
  };

  const finalTotal = state.total;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Button>
            <h1 className="text-2xl font-bold">Thanh toán</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Restaurant Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Thông tin nhà hàng
                </CardTitle>
              </CardHeader>
              <CardContent>
                {state.restaurant && (
                  <div className="flex items-center gap-4">
                    <img
                      src={state.restaurant.imageUrl || "https://via.placeholder.com/80"}
                      alt={state.restaurant.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div>
                      <h3 className="font-semibold">{state.restaurant.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {state.items.length} món • {formatPrice(state.total)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Address Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Thông tin giao hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAddress && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium mb-1">{selectedAddress.name}</p>
                    <p className="text-sm text-muted-foreground flex items-start gap-2">
                      <Phone className="h-4 w-4 mt-0.5" />
                      {selectedAddress.phone}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-start gap-2 mt-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      {selectedAddress.address}, {selectedAddress.ward}, {selectedAddress.district}, {selectedAddress.province}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Ghi chú cho nhà hàng (tùy chọn)
                  </label>
                  <Textarea
                    name="note"
                    value={formData.note}
                    onChange={handleInputChange}
                    placeholder="Ví dụ: Không hành, giao trước 12h..."
                    rows={3}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Đơn hàng của bạn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items List */}
                <div className="space-y-3">
                  {state.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground">
                          {item.quantity} x {formatPrice(item.price)}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tạm tính</span>
                    <span>{formatPrice(state.total)}</span>
                  </div>
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Tổng cộng</span>
                  <span className="text-lg font-bold text-primary">
                    {formatPrice(finalTotal)}
                  </span>
                </div>

                {/* Place Order Button */}
                <Button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {loading ? "Đang xử lý..." : "Đặt hàng"}
                </Button>

                {/* Info */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Thời gian giao hàng dự kiến: 20-30 phút</p>
                  <p>• Bạn có thể thanh toán khi nhận hàng hoặc qua VNPay</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;

