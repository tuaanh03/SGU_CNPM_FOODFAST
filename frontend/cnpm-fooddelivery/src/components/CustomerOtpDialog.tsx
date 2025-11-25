import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import API_BASE_URL from '@/config/api';

interface CustomerOtpDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  onSuccess: () => void;
}

export default function CustomerOtpDialog({ open, onClose, orderId, onSuccess }: CustomerOtpDialogProps) {
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      toast.error('Vui lòng nhập đúng 6 số OTP');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get token from localStorage (customer đã đăng nhập)
      // Lưu ý: token được lưu với key 'customer_token' không phải 'token'
      const token = localStorage.getItem('customer_token');

      if (!token) {
        toast.error('Vui lòng đăng nhập để xác nhận nhận hàng');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/deliveries/order/${orderId}/verify-customer-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ otp }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Xác nhận nhận hàng thành công!');
        setOtp('');
        onSuccess();
        onClose();
      } else {
        toast.error(data.message || 'Mã OTP không chính xác');
      }
    } catch (error) {
      console.error('Error verifying customer OTP:', error);
      toast.error('Có lỗi xảy ra khi xác nhận OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOtp('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🔐 Xác nhận nhận hàng</DialogTitle>
          <DialogDescription>
            Drone đã đến vị trí của bạn. Vui lòng nhập mã OTP để xác nhận đã nhận hàng.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Mã OTP (6 số)</Label>
            <Input
              id="otp"
              type="text"
              placeholder="Nhập mã OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              disabled={isSubmitting}
              autoFocus
            />
            <p className="text-sm text-muted-foreground">
              Mã OTP được hiển thị trên màn hình drone
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xác nhận...
                </>
              ) : (
                'Xác nhận'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

