import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface DroneLocationEvent {
  deliveryId: string;
  droneId: string;
  orderId: string;
  lat: number;
  lng: number;
  timestamp: string;
}

interface OtpGeneratedEvent {
  deliveryId: string;
  orderId: string;
  otp: string;
  expiresIn: number;
  timestamp: string;
}

interface DroneArrivedEvent {
  deliveryId: string;
  droneId: string;
  orderId: string;
  location: string;
  timestamp: string;
}

interface AdminSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  realtimeDronePositions: Record<string, { lat: number; lng: number }>; // orderId -> position
  currentOtps: Record<string, string>; // orderId -> otp
  joinOrder: (orderId: string) => void;
  leaveOrder: (orderId: string) => void;
}

const AdminSocketContext = createContext<AdminSocketContextType | undefined>(undefined);

export const AdminSocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeDronePositions, setRealtimeDronePositions] = useState<Record<string, { lat: number; lng: number }>>({});
  const [currentOtps, setCurrentOtps] = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3011';

    console.log('🔌 [AdminSocketProvider] MOUNTING - Initializing socket...');
    console.log('📍 Socket URL:', SOCKET_URL);

    // Prevent duplicate socket creation
    if (socketRef.current) {
      console.log('⚠️ [AdminSocket] Socket already exists, skipping creation');
      return;
    }

    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socketInstance;

    // Connection events
    socketInstance.on('connect', () => {
      console.log('✅ [AdminSocket] Connected - ID:', socketInstance.id);
      setIsConnected(true);
      socketInstance.emit('join-room', 'admin-dashboard');
      console.log('📢 [AdminSocket] Joined room: admin-dashboard');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ [AdminSocket] Disconnected - Reason:', reason);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('🔄 [AdminSocket] Reconnected - Attempt:', attemptNumber);
      socketInstance.emit('join-room', 'admin-dashboard');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ [AdminSocket] Connection error:', error.message);
    });

    // Listen for drone:location event
    socketInstance.on('drone:location', (data: DroneLocationEvent) => {
      console.log('📨 [AdminSocket] Received drone:location:', data);

      if (data.orderId && data.lat && data.lng) {
        setRealtimeDronePositions(prev => ({
          ...prev,
          [data.orderId]: { lat: data.lat, lng: data.lng }
        }));
        console.log(`🚁 [AdminSocket] Updated drone position for order ${data.orderId}: [${data.lat}, ${data.lng}]`);
      }
    });

    // Listen for otp:generated event
    socketInstance.on('otp:generated', (data: OtpGeneratedEvent) => {
      console.log('📨 [AdminSocket] Received otp:generated:', data);

      if (data.orderId && data.otp) {
        setCurrentOtps(prev => ({
          ...prev,
          [data.orderId]: data.otp
        }));

        toast.success('🔐 OTP đã được tạo', {
          description: `Mã OTP: ${data.otp} (${data.expiresIn}s)`,
          duration: data.expiresIn * 1000,
        });
      }
    });

    // Listen for drone:arrived event
    socketInstance.on('drone:arrived', (data: DroneArrivedEvent) => {
      console.log('📨 [AdminSocket] Received drone:arrived:', data);

      toast.info('🚁 Drone đã đến!', {
        description: `Drone đã đến ${data.location}`,
        duration: 5000,
      });
    });

    console.log('📝 [AdminSocket] Event listeners registered');
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('🔌 [AdminSocketProvider] UNMOUNTING - Cleaning up socket');
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
      console.log(`📢 [AdminSocket] Joined order: ${orderId}`);
    }
  };

  const leaveOrder = (orderId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave:order', { orderId });
      console.log(`📢 [AdminSocket] Left order: ${orderId}`);
    }
  };

  return (
    <AdminSocketContext.Provider
      value={{
        socket,
        isConnected,
        realtimeDronePositions,
        currentOtps,
        joinOrder,
        leaveOrder,
      }}
    >
      {children}
    </AdminSocketContext.Provider>
  );
};

export const useAdminSocket = () => {
  const context = useContext(AdminSocketContext);
  if (!context) {
    throw new Error('useAdminSocket must be used within AdminSocketProvider');
  }
  return context;
};

