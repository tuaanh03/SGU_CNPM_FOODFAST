import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface OrderStatusUpdateEvent {
  orderId: string;
  storeId?: string;
  restaurantStatus: string;
  timestamp: string;
}

interface DroneAssignedEvent {
  orderId: string;
  droneId: string;
  droneName: string;
  estimatedTime: number;
  timestamp: string;
}

interface DroneLocationEvent {
  orderId: string;
  droneId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface CustomerSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinOrder: (orderId: string) => void;
  leaveOrder: (orderId: string) => void;
  orderStatuses: Record<string, string>; // orderId -> status
  droneLocations: Record<string, { lat: number; lng: number }>; // orderId -> location
  customerOtps: Record<string, string>; // orderId -> OTP (for customer verification)
  droneArrivedOrders: Set<string>; // ✅ Track đơn hàng nào drone đã đến (cần nhập OTP)
}

const CustomerSocketContext = createContext<CustomerSocketContextType | undefined>(undefined);

export const CustomerSocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>({});
  const [droneLocations, setDroneLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [customerOtps, setCustomerOtps] = useState<Record<string, string>>({});
  const [droneArrivedOrders, setDroneArrivedOrders] = useState<Set<string>>(new Set()); // ✅ Track drone arrived
  const socketRef = useRef<Socket | null>(null);

  // ✅ Load droneArrivedOrders từ localStorage khi mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('droneArrivedOrders');
      if (saved) {
        const arrivedOrders = JSON.parse(saved) as string[];
        setDroneArrivedOrders(new Set(arrivedOrders));
        console.log('✅ [CustomerSocket] Loaded droneArrivedOrders from localStorage:', arrivedOrders);
      }
    } catch (error) {
      console.error('❌ [CustomerSocket] Error loading droneArrivedOrders from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3011';

    console.log('🔌 [CustomerSocketProvider] MOUNTING - Initializing socket...');
    console.log('📍 Socket URL:', SOCKET_URL);

    // Prevent duplicate socket creation
    if (socketRef.current) {
      console.log('⚠️ [CustomerSocket] Socket already exists, skipping creation');
      return;
    }

    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socketInstance;

    // Connection events
    socketInstance.on('connect', () => {
      console.log('✅ [CustomerSocket] Connected - ID:', socketInstance.id);
      setIsConnected(true);
      socketInstance.emit('join-room', 'customer');
      console.log('📢 [CustomerSocket] Joined room: customer');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ [CustomerSocket] Disconnected - Reason:', reason);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 [CustomerSocket] Reconnected - Attempt:', attemptNumber);
      socketInstance.emit('join-room', 'customer');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ [CustomerSocket] Connection error:', error.message);
    });

    // Listen for order status updates
    socketInstance.on('order:status:update', (data: OrderStatusUpdateEvent) => {
      console.log('📨 [CustomerSocket] Received order:status:update:', data);

      if (data.orderId && data.restaurantStatus) {
        setOrderStatuses(prev => ({
          ...prev,
          [data.orderId]: data.restaurantStatus
        }));

        const statusMessages: Record<string, string> = {
          'CONFIRMED': '✅ Đơn hàng đã xác nhận',
          'PREPARING': '👨‍🍳 Đang chuẩn bị món ăn',
          'READY_FOR_PICKUP': '📦 Sẵn sàng giao hàng',
          'PICKED_UP': '🚁 Drone đã nhận hàng',
          'DELIVERING': '🚁 Đang giao hàng',
          'DELIVERED': '✅ Đã giao hàng thành công',
        };

        const message = statusMessages[data.restaurantStatus] || `Trạng thái: ${data.restaurantStatus}`;

        toast.info('📦 Cập nhật đơn hàng', {
          description: message,
          duration: 5000,
        });
      }
    });

    // Listen for drone assigned
    socketInstance.on('order:drone-assigned', (data: DroneAssignedEvent) => {
      console.log('📨 [CustomerSocket] Received order:drone-assigned:', data);

      if (data.orderId) {
        toast.success('🚁 Drone đã được gán!', {
          description: `${data.droneName} sẽ giao hàng cho bạn trong ${data.estimatedTime} phút`,
          duration: 8000,
        });
      }
    });

    // Listen for drone location updates
    socketInstance.on('drone:location', (data: DroneLocationEvent) => {
      console.log('📨 [CustomerSocket] Received drone:location:', data);

      if (data.orderId && data.lat && data.lng) {
        setDroneLocations(prev => ({
          ...prev,
          [data.orderId]: { lat: data.lat, lng: data.lng }
        }));
      }
    });

    // Listen for drone:arrived:customer event
    socketInstance.on('drone:arrived:customer', (data: any) => {
      console.log('📨 [CustomerSocket] Received drone:arrived:customer:', data);
      console.log('🚁 [CustomerSocket] Drone arrived at your location!', {
        orderId: data.orderId,
        deliveryId: data.deliveryId,
        droneId: data.droneId
      });

      // ✅ Thêm vào droneArrivedOrders
      if (data.orderId) {
        setDroneArrivedOrders(prev => {
          const newSet = new Set(prev);
          newSet.add(data.orderId);

          // ✅ Lưu vào localStorage để persistent qua reload
          const arrivedOrders = Array.from(newSet);
          localStorage.setItem('droneArrivedOrders', JSON.stringify(arrivedOrders));
          console.log('✅ [CustomerSocket] Added to droneArrivedOrders & localStorage:', data.orderId);

          return newSet;
        });
      }

      // Show toast notification
      toast.info('🚁 Drone đã đến!', {
        description: 'Drone đã đến vị trí của bạn. Vui lòng nhập mã OTP để nhận hàng.',
        duration: 10000,
      });
    });

    // Listen for customer:otp:generated event
    socketInstance.on('customer:otp:generated', (data: any) => {
      console.log('📨 [CustomerSocket] Received customer:otp:generated:', data);
      console.log('🔐 [CustomerSocket] Customer OTP:', {
        orderId: data.orderId,
        otp: data.otp,
        expiresIn: data.expiresIn
      });

      // Save OTP to state để component có thể lấy và hiển thị dialog
      if (data.orderId && data.otp) {
        setCustomerOtps(prev => ({
          ...prev,
          [data.orderId]: data.otp
        }));
      }

      // Show toast with OTP
      toast.success('🔐 Mã xác nhận nhận hàng', {
        description: `Mã OTP của bạn: ${data.otp} (Có hiệu lực ${data.expiresIn}s)`,
        duration: data.expiresIn * 1000,
      });
    });

    // Listen for delivery:completed event
    socketInstance.on('delivery:completed', (data: any) => {
      console.log('📨 [CustomerSocket] Received delivery:completed:', data);
      console.log('🎉 [CustomerSocket] DELIVERY COMPLETED:', {
        orderId: data.orderId,
        deliveryId: data.deliveryId,
        deliveredAt: data.deliveredAt
      });

      // Show toast notification
      toast.success('🎉 Đơn hàng đã được giao!', {
        description: `Đơn hàng #${data.orderId?.slice(0, 8)}... đã được giao đến bạn thành công`,
        duration: 10000,
      });

      // Update order status
      if (data.orderId) {
        setOrderStatuses(prev => ({
          ...prev,
          [data.orderId]: 'DELIVERED'
        }));
      }
    });

    console.log('📝 [CustomerSocket] Event listeners registered');
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('🔌 [CustomerSocketProvider] UNMOUNTING - Cleaning up socket');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
        socketRef.current = null;
      }
    };
  }, []);

  const joinOrder = (orderId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join:order', { orderId });
      console.log(`📢 [CustomerSocket] Joined order: ${orderId}`);
    }
  };

  const leaveOrder = (orderId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave:order', { orderId });
      console.log(`📢 [CustomerSocket] Left order: ${orderId}`);
    }
  };

  return (
    <CustomerSocketContext.Provider
      value={{
        socket,
        isConnected,
        joinOrder,
        leaveOrder,
        orderStatuses,
        droneLocations,
        customerOtps,
        droneArrivedOrders, // ✅ Export để components sử dụng
      }}
    >
      {children}
    </CustomerSocketContext.Provider>
  );
};

export const useCustomerSocket = () => {
  const context = useContext(CustomerSocketContext);
  if (!context) {
    throw new Error('useCustomerSocket must be used within CustomerSocketProvider');
  }
  return context;
};

