import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useCart } from "@/contexts/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Phone, Store, ShoppingBag, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "@/services/order.service";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { state, formatPrice } = useCart();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    deliveryAddress: "",
    contactPhone: "",
    note: "",
  });

  // Nếu giỏ hàng trống, redirect về trang chủ
  useEffect(() => {
    if (state.items.length === 0) {
      toast.error("Giỏ hàng của bạn đang trống");
      navigate("/");
    }
  }, [state.items.length, navigate]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.deliveryAddress.trim()) {
      toast.error("Vui lòng nhập địa chỉ giao hàng");
      return false;
    }
    if (!formData.contactPhone.trim()) {
      toast.error("Vui lòng nhập số điện thoại");
      return false;
    }
    // Validate phone number (simple check)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.contactPhone.replace(/\s/g, ""))) {
      toast.error("Số điện thoại không hợp lệ (10 chữ số)");
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;
    if (!state.restaurant) {
      toast.error("Không tìm thấy thông tin nhà hàng");
      return;
    }

    // Kiểm tra đăng nhập
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Vui lòng đăng nhập để đặt hàng");
      navigate("/test-auth");
      return;
    }

    setLoading(true);
    try {
      // Gọi API tạo order từ cart qua API Gateway
      const response = await orderService.createOrderFromCart({
        storeId: state.restaurant.id,
        deliveryAddress: formData.deliveryAddress,
        contactPhone: formData.contactPhone,
        note: formData.note || undefined,
      });

      if (response.success) {
        toast.success("Đặt hàng thành công! Đang chuyển đến trang thanh toán...");

        // Backend sẽ tự động xử lý qua Kafka và tạo payment URL
        // Sau 2 giây, chuyển đến trang my-orders
        setTimeout(() => {
          navigate("/my-orders");
        }, 2000);
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
          {/* Left Column - Form */}
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
                      src={state.restaurant.imageUrl}
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

            {/* Delivery Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Thông tin giao hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Địa chỉ giao hàng *
                  </label>
                  <Input
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleInputChange}
                    placeholder="Ví dụ: 123 Phố Huế, Hai Bà Trưng, Hà Nội"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Số điện thoại *
                  </label>
                  <Input
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleInputChange}
                    placeholder="Ví dụ: 0901234567"
                    className="w-full"
                  />
                </div>

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

