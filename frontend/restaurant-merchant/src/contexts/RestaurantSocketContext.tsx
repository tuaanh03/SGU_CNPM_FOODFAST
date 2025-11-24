import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface DroneArrivedEvent {
  deliveryId: string;
  droneId: string;
  orderId: string;
  timestamp: string;
}

interface OtpGeneratedEvent {
  deliveryId: string;
  orderId: string;
  otp: string;
  expiresIn: number;
  timestamp: string;
}

interface OrderStatusUpdateEvent {
  orderId: string;
  restaurantStatus: string;
  readyAt?: string;
  timestamp: string;
}

interface RestaurantSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  storeId: string | null;
  droneArrivedOrders: Set<string>;
  currentOtp: Record<string, string>; // orderId -> otp
  orderStatusUpdates: Record<string, string>; // orderId -> status
  joinOrder: (orderId: string) => void;
  leaveOrder: (orderId: string) => void;
}

const RestaurantSocketContext = createContext<RestaurantSocketContextType | undefined>(undefined);

export const RestaurantSocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [droneArrivedOrders, setDroneArrivedOrders] = useState<Set<string>>(new Set());
  const [currentOtp, setCurrentOtp] = useState<Record<string, string>>({});
  const [orderStatusUpdates, setOrderStatusUpdates] = useState<Record<string, string>>({});
  const [storeId, setStoreId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Load storeId from localStorage or API
  useEffect(() => {
    const loadStoreId = async () => {
      try {
        // Try to get from localStorage first
        const storeInfo = localStorage.getItem('storeInfo');
        if (storeInfo) {
          const parsed = JSON.parse(storeInfo);
          if (parsed.id) {
            setStoreId(parsed.id);
            console.log('✅ [RestaurantSocket] Loaded storeId from localStorage:', parsed.id);
            return;
          }
        }

        // If not in localStorage, try to load via storeService
        console.log('🔄 [RestaurantSocket] Loading storeId from API...');

        // Dynamically import to avoid circular dependency
        const { storeService } = await import('../services/store.service');
        const response = await storeService.getMyStore();

        if (response.success && response.data) {
          setStoreId(response.data.id);
          localStorage.setItem('storeInfo', JSON.stringify(response.data));
          console.log('✅ [RestaurantSocket] Loaded storeId from API:', response.data.id);
        } else {
          console.warn('⚠️ [RestaurantSocket] No store found for merchant');
        }
      } catch (error) {
        console.error('❌ [RestaurantSocket] Error loading storeId:', error);
      }
    };

    loadStoreId();
  }, []);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3011';

    console.log('🔌 [RestaurantSocketProvider] MOUNTING - Initializing socket...');
    console.log('📍 Socket URL:', SOCKET_URL);

    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('✅ [RestaurantSocket] Connected - ID:', socketInstance.id);
      setIsConnected(true);

      // Note: Specific store room will be joined by separate useEffect when storeId loads
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ [RestaurantSocket] Disconnected - Reason:', reason);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 [RestaurantSocket] Reconnected - Attempt:', attemptNumber);
      socketInstance.emit('join-room', 'restaurant-merchants');

      // Specific store room will be rejoined by separate useEffect
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ [RestaurantSocket] Connection error:', error.message);
    });

    // Listen for drone:arrived event
    socketInstance.on('drone:arrived', (data: DroneArrivedEvent) => {
      console.log('📨 [RestaurantSocket] Received drone:arrived:', data);

      if (data.orderId) {
        setDroneArrivedOrders(prev => {
          const newSet = new Set(prev);
          newSet.add(data.orderId);
          console.log('✅ [RestaurantSocket] Added to droneArrivedOrders:', data.orderId);
          console.log('📋 [RestaurantSocket] Current droneArrivedOrders:', Array.from(newSet));
          return newSet;
        });

        toast.success('🚁 Drone đã đến!', {
          description: `Đơn hàng ${data.orderId.slice(0, 8)}... - Vui lòng nhập OTP`,
          duration: 10000,
        });
      }
    });

    // Listen for otp:generated event
    socketInstance.on('otp:generated', (data: OtpGeneratedEvent) => {
      console.log('📨 [RestaurantSocket] Received otp:generated:', data);

      if (data.orderId && data.otp) {
        setCurrentOtp(prev => ({
          ...prev,
          [data.orderId]: data.otp
        }));

        toast.info('🔐 OTP đã được tạo', {
          description: `Mã OTP: ${data.otp} (${data.expiresIn}s)`,
          duration: data.expiresIn * 1000,
        });
      }
    });

    // Listen for order:confirmed event (NEW ORDER)
    socketInstance.on('order:confirmed', (data: any) => {
      console.log('📨 [RestaurantSocket] Received order:confirmed:', data);
      console.log('🆕 [RestaurantSocket] NEW ORDER CONFIRMED:', {
        orderId: data.orderId,
        storeId: data.storeId,
        totalPrice: data.totalPrice,
        items: data.items?.length || 0
      });

      // Show toast notification
      toast.success('🎉 Đơn hàng mới!', {
        description: `Order #${data.orderId?.slice(0, 8)}... - ${data.totalPrice?.toLocaleString()}đ`,
        duration: 10000,
      });

      // Note: MerchantOrdersPage sẽ handle việc add vào list thông qua listener riêng
    });

    // Listen for order:status:update event
    socketInstance.on('order:status:update', (data: OrderStatusUpdateEvent) => {
      console.log('📨 [RestaurantSocket] Received order:status:update:', data);

      if (data.orderId && data.restaurantStatus) {
        setOrderStatusUpdates(prev => ({
          ...prev,
          [data.orderId]: data.restaurantStatus
        }));

        const statusMessages: Record<string, string> = {
          'CONFIRMED': '✅ Đơn hàng đã xác nhận',
          'PREPARING': '👨‍🍳 Đang chuẩn bị món ăn',
          'READY_FOR_PICKUP': '📦 Đơn hàng sẵn sàng - Đã thông báo đội drone',
          'PICKED_UP': '🚁 Drone đã nhận hàng',
          'DELIVERING': '🚁 Đang giao hàng',
          'DELIVERED': '✅ Đã giao hàng thành công',
        };

        const message = statusMessages[data.restaurantStatus] || `Cập nhật trạng thái: ${data.restaurantStatus}`;

        toast.success('📦 Cập nhật đơn hàng', {
          description: message,
          duration: 5000,
        });
      }
    });

    console.log('📝 [RestaurantSocket] Event listeners registered (including order:confirmed)');

    // 🧪 DEBUG: Listen to ALL events to debug
    socketInstance.onAny((eventName, ...args) => {
      console.log(`🔔 [RestaurantSocket] Received ANY event: "${eventName}"`, args);
      console.log(`⏰ [RestaurantSocket] Event received at: ${new Date().toISOString()}`);
    });

    // 🧪 DEBUG: Track connection state changes
    socketInstance.on('disconnect', (reason) => {
      console.error(`❌ [RestaurantSocket] DISCONNECTED - Reason: ${reason}`);
      console.error(`⏰ Disconnected at: ${new Date().toISOString()}`);
    });

    socketInstance.on('error', (error) => {
      console.error(`❌ [RestaurantSocket] ERROR:`, error);
    });

    socketInstance.io.on('reconnect_attempt', () => {
      console.log('🔄 [RestaurantSocket] Attempting to reconnect...');
    });

    socketInstance.io.on('reconnect_failed', () => {
      console.error('❌ [RestaurantSocket] Reconnection failed');
    });

    console.log('🎯 [RestaurantSocket] Socket instance created:', {
      id: socketInstance.id,
      connected: socketInstance.connected,
      disconnected: socketInstance.disconnected,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('🔌 [RestaurantSocketProvider] UNMOUNTING - Cleaning up socket');
      if (socketRef.current) {
        socketRef.current.offAny();
        socketRef.current.disconnect();
        socketRef.current.removeAllListeners();
        socketRef.current = null;
      }
    };
  }, []); // ✅ Empty deps - socket chỉ tạo 1 lần

  // Auto-join restaurant room when storeId is loaded after socket connected
  useEffect(() => {
    if (!storeId) {
      console.log('🔍 [RestaurantSocket] StoreId not loaded yet, waiting...');
      return;
    }

    if (!socketRef.current) {
      console.log('🔍 [RestaurantSocket] Socket not initialized yet, waiting...');
      return;
    }

    console.log('🔍 [RestaurantSocket] StoreId effect triggered:', {
      hasSocket: !!socketRef.current,
      isConnected: socketRef.current.connected,
      storeId: storeId
    });

    if (socketRef.current.connected) {
      console.log('📢 [RestaurantSocket] StoreId loaded and socket connected, joining room: restaurant:' + storeId);
      socketRef.current.emit('join:restaurant', { storeId });

      // Listen for join confirmation
      socketRef.current.once('joined:restaurant', (data: any) => {
        console.log('✅ [RestaurantSocket] Room joined successfully:', data);
        console.log('🎯 [RestaurantSocket] Ready to receive events on room: restaurant:' + storeId);
        console.log('🎯 [RestaurantSocket] Waiting for order:confirmed events...');
      });
    } else {
      console.log('⏳ [RestaurantSocket] StoreId loaded but socket not connected yet. Will join on connect.');

      // Listen for connect event to join room when socket connects
      const handleConnect = () => {
        if (socketRef.current && storeId) {
          console.log('📢 [RestaurantSocket] Socket connected, now joining room: restaurant:' + storeId);
          socketRef.current.emit('join:restaurant', { storeId });

          // Listen for join confirmation
          socketRef.current.once('joined:restaurant', (data: any) => {
            console.log('✅ [RestaurantSocket] Room joined successfully:', data);
            console.log('🎯 [RestaurantSocket] Ready to receive events on room: restaurant:' + storeId);
            console.log('🎯 [RestaurantSocket] Waiting for order:confirmed events...');
          });
        }
      };

      socketRef.current.once('connect', handleConnect);

      return () => {
        socketRef.current?.off('connect', handleConnect);
      };
    }
  }, [storeId]);

  const joinOrder = (orderId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join:order', { orderId });
      console.log(`📢 [RestaurantSocket] Joined order: ${orderId}`);
    }
  };

  const leaveOrder = (orderId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave:order', { orderId });
      console.log(`📢 [RestaurantSocket] Left order: ${orderId}`);
    }
  };

  return (
    <RestaurantSocketContext.Provider
      value={{
        socket,
        isConnected,
        storeId,
        droneArrivedOrders,
        currentOtp,
        orderStatusUpdates,
        joinOrder,
        leaveOrder,
      }}
    >
      {children}
    </RestaurantSocketContext.Provider>
  );
};

export const useRestaurantSocket = () => {
  const context = useContext(RestaurantSocketContext);
  if (!context) {
    throw new Error('useRestaurantSocket must be used within RestaurantSocketProvider');
  }
  return context;
};

