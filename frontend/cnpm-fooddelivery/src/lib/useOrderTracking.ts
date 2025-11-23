import { useEffect, useState, useRef } from 'react';
import { useSocket } from './useSocket';

interface OrderStatusUpdate {
  orderId: string;
  storeId: string;
  restaurantStatus: string;
  timestamp: string;
}

export const useOrderTracking = (orderId: string | null) => {
  const [orderStatus, setOrderStatus] = useState<OrderStatusUpdate | null>(null);
  const { connect,  emit, on, off, isConnected } = useSocket();
  const orderIdRef = useRef(orderId);

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    // Connect socket một lần
    connect();

    // Listen for order status updates
    const handleStatusUpdate = (data: OrderStatusUpdate) => {
      console.log('📦 Order status updated:', data);
      setOrderStatus(data);
    };

    // Listen for joined confirmation
    const handleJoined = (data: any) => {
      console.log('✅ Joined order room:', data);
    };

    // Join order room khi connect
    const handleConnect = () => {
      const currentOrderId = orderIdRef.current;
      if (currentOrderId) {
        console.log('🔌 Connected, joining order room:', currentOrderId);
        emit('join:order', { orderId: currentOrderId });
      }
    };

    on('connect', handleConnect);
    on('order:status:update', handleStatusUpdate);
    on('joined:order', handleJoined);

    // Join ngay nếu đã connected
    if (isConnected && orderId) {
      emit('join:order', { orderId });
    }

    // Cleanup khi orderId thay đổi hoặc unmount
    return () => {
      const currentOrderId = orderIdRef.current;
      if (currentOrderId) {
        emit('leave:order', { orderId: currentOrderId });
      }
      off('connect', handleConnect);
      off('order:status:update', handleStatusUpdate);
      off('joined:order', handleJoined);
    };
  }, [orderId]); // Chỉ depend vào orderId

  return {
    orderStatus,
    isConnected,
  };
};

