import { useEffect, useState, useRef } from 'react';
import { useSocket } from './useSocket';
import { toast } from 'sonner';

interface NewOrder {
  orderId: string;
  storeId: string;
  items: any[];
  totalPrice: number;
  deliveryAddress?: string;
  contactPhone?: string;
  note?: string;
  confirmedAt: string;
  estimatedPrepTime?: number;
  status: string;
}

interface OrderStatusUpdate {
  orderId: string;
  storeId: string;
  restaurantStatus: string;
  timestamp: string;
}

export const useRestaurantOrders = (storeId: string | null) => {
  const [newOrders, setNewOrders] = useState<NewOrder[]>([]);
  const [lastOrder, setLastOrder] = useState<NewOrder | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<OrderStatusUpdate | null>(null);
  const { connect, emit, on, off, isConnected } = useSocket();
  const storeIdRef = useRef(storeId);

  useEffect(() => {
    storeIdRef.current = storeId;
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;

    // Connect socket một lần
    connect();

    // Listen for new orders
    const handleNewOrder = (order: NewOrder) => {
      console.log('🆕 New order received:', order);
      setLastOrder(order);
      setNewOrders((prev) => [order, ...prev]);

      // Show toast notification
      toast.success('Đơn hàng mới!', {
        description: `Tổng tiền: ${order.totalPrice.toLocaleString('vi-VN')}đ`,
      });

      // Play notification sound (optional)
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {
          // Ignore if sound fails
        });
      } catch (error) {
        // Ignore sound error
      }
    };

    // Listen for order status updates (từ Kafka)
    const handleStatusUpdate = (data: OrderStatusUpdate) => {
      console.log('📦 Order status updated:', data);
      setStatusUpdate(data);

      // Show toast notification
      const statusText = {
        'PREPARING': 'Đang chuẩn bị',
        'READY': 'Sẵn sàng giao',
        'DELIVERING': 'Đang giao',
        'COMPLETED': 'Hoàn thành',
      }[data.restaurantStatus] || data.restaurantStatus;

      toast.info(`Đơn hàng ${data.orderId.slice(0, 8)}: ${statusText}`);
    };

    // Listen for OTP generated (when drone arrives)
    const handleOtpGenerated = (data: any) => {
      console.log('🔐 OTP Generated:', data);

      // Show toast with OTP prominently
      toast.success(`🚁 Drone đã đến! Mã OTP: ${data.otp}`, {
        description: `Đơn hàng ${data.orderId.slice(0, 8)} - Hết hạn sau ${data.expiresIn}s`,
        duration: 30000, // Show for 30 seconds
      });

      // Play notification sound
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      } catch (error) {}
    };

    // Listen for joined confirmation
    const handleJoined = (data: any) => {
      console.log('✅ Joined restaurant room:', data);
    };

    // Join restaurant room khi connect
    const handleConnect = () => {
      const currentStoreId = storeIdRef.current;
      if (currentStoreId) {
        console.log('🔌 Connected, joining restaurant room:', currentStoreId);
        emit('join:restaurant', { storeId: currentStoreId });
      }
    };

    on('connect', handleConnect);
    on('order:confirmed', handleNewOrder);
    on('order:status:update', handleStatusUpdate); // Listen status update
    on('otp:generated', handleOtpGenerated); // Listen OTP
    on('joined:restaurant', handleJoined);

    // Join ngay nếu đã connected
    if (isConnected && storeId) {
      emit('join:restaurant', { storeId });
    }

    // Cleanup khi storeId thay đổi hoặc unmount
    return () => {
      const currentStoreId = storeIdRef.current;
      if (currentStoreId) {
        emit('leave:restaurant', { storeId: currentStoreId });
      }
      off('connect', handleConnect);
      off('order:confirmed', handleNewOrder);
      off('order:status:update', handleStatusUpdate);
      off('otp:generated', handleOtpGenerated);
      off('joined:restaurant', handleJoined);
    };
  }, [storeId]); // Chỉ depend vào storeId

  const clearLastOrder = () => {
    setLastOrder(null);
  };

  const clearNewOrders = () => {
    setNewOrders([]);
  };

  return {
    newOrders,
    lastOrder,
    statusUpdate,
    isConnected,
    clearLastOrder,
    clearNewOrders,
  };
};

