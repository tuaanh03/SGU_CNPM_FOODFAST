import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import API_BASE_URL from "@/config/api";

interface OtpVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}

const OtpVerificationDialog = ({
  open,
  onClose,
  orderId,
  onSuccess
}: OtpVerificationDialogProps) => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Mã OTP phải có 6 chữ số");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/deliveries/order/${orderId}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(data.message || "Mã OTP không đúng");
      }
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra khi xác thực OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOtp("");
    setError("");
    setSuccess(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xác nhận nhận hàng</DialogTitle>
          <DialogDescription>
            Nhập mã OTP từ Drone để xác nhận đã nhận hàng
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!success ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">Mã OTP (6 chữ số)</Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="Nhập mã OTP"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setOtp(value);
                  }}
                  disabled={loading}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              {error && (
                <Card className="border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </Card>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleVerify}
                  disabled={loading || otp.length !== 6}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Xác nhận
                </Button>
                <Button variant="outline" onClick={handleClose} disabled={loading}>
                  Hủy
                </Button>
              </div>
            </>
          ) : (
            <Card className="border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-800">
                  Xác thực thành công! Drone đang bay đến khách hàng...
                </p>
              </div>
            </Card>
          )}
        </div>

        <div className="text-xs text-gray-500 text-center">
          Đơn hàng: {orderId.slice(0, 8)}...
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OtpVerificationDialog;

