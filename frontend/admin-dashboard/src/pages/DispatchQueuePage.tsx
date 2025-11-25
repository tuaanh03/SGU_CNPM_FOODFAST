import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Drone, LogOut, MapPin, Store, User, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useSocket } from "@/lib/useSocket";
import { deliveryService, type Delivery } from "@/services/delivery.service";

interface DeliveryNotification {
    orderId: string;
    storeId: string;
    restaurantStatus: string;
    readyAt: string;
    pickupLocation?: {
        storeId: string;
        restaurantName: string;
        address: string;
        lat: number;
        lng: number;
    };
    customerInfo?: any;
    items?: any[];
    totalPrice?: number;
    timestamp: string;
}

const DispatchQueuePage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [deliveryNotifications, setDeliveryNotifications] = useState<DeliveryNotification[]>([]);

    // Socket connection for real-time dispatch updates
    const { connect, emit, on, off, isConnected } = useSocket();

    // Fetch deliveries từ DB
    useEffect(() => {
        const fetchDeliveries = async () => {
            try {
                setLoading(true);
                const response = await deliveryService.getAllDeliveries({ status: 'PENDING' });
                if (response.success) {
                    setDeliveries(response.data);
                }
            } catch (error) {
                console.error('Error fetching deliveries:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDeliveries();
    }, []);

    // Subscribe to dispatch room for real-time delivery notifications
    useEffect(() => {
        connect();

        const handleConnect = () => {
            console.log('🔌 Dispatch queue connected to socket');
            emit('join:dispatch', {});
        };

        const handleJoinedDispatch = (data: any) => {
            console.log('✅ Joined dispatch room:', data);
        };

        const handleDeliveryCreated = async (payload: DeliveryNotification) => {
            console.log('🚚 New delivery notification:', payload);
            setDeliveryNotifications(prev => [payload, ...prev]);

            // Reload deliveries để cập nhật list
            try {
                const response = await deliveryService.getAllDeliveries({ status: 'PENDING' });
                if (response.success) {
                    setDeliveries(response.data);
                }
            } catch (error) {
                console.error('Error reloading deliveries:', error);
            }
        };

        on('connect', handleConnect);
        on('joined:dispatch', handleJoinedDispatch);
        on('dispatch:delivery:created', handleDeliveryCreated);

        // Join immediately if already connected
        if (isConnected) {
            emit('join:dispatch', {});
        }

        return () => {
            emit('leave:dispatch', {});
            off('connect', handleConnect);
            off('joined:dispatch', handleJoinedDispatch);
            off('dispatch:delivery:created', handleDeliveryCreated);
        };
    }, [connect, emit, on, off, isConnected]);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate("/")}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="rounded-lg bg-blue-600 p-2">
                                <Drone className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Hàng Đợi Dispatch
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {user?.name} - {deliveries.length} đơn hàng chờ xử lý
                                </p>
                            </div>
                        </div>
                        <Button onClick={handleLogout} variant="outline">
                            <LogOut className="mr-2 h-4 w-4" />
                            Đăng xuất
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Real-time Delivery Notifications */}
                {deliveryNotifications.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            Đơn hàng sẵn sàng giao (Real-time) - {deliveryNotifications.length} đơn
                        </h2>
                        <div className="grid gap-4 mb-6">
                            {deliveryNotifications.map((delivery, idx) => (
                                <Card
                                    key={`${delivery.orderId}-${idx}`}
                                    className="border-green-500 border-2 bg-green-50 cursor-pointer transition-all hover:shadow-lg"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('Navigating to order:', delivery.orderId);
                                        navigate(`/order/${delivery.orderId}`);
                                    }}
                                >
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    🚚 Order: {delivery.orderId.slice(0, 8)}...
                                                    <Badge className="bg-green-600">READY FOR PICKUP</Badge>
                                                </CardTitle>
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <Clock className="mr-1 h-4 w-4" />
                                                    {new Date(delivery.readyAt || delivery.timestamp).toLocaleString('vi-VN')}
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {delivery.pickupLocation && (
                                                <div className="flex items-start space-x-2">
                                                    <Store className="h-5 w-5 text-orange-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {delivery.pickupLocation.restaurantName}
                                                        </p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {delivery.pickupLocation.address}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {delivery.customerInfo && (
                                                <div className="flex items-start space-x-2">
                                                    <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">Giao đến</p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {delivery.customerInfo.deliveryAddress || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {delivery.totalPrice && (
                                            <div className="mt-4 flex items-center space-x-4 rounded-lg bg-white p-3">
                                                <div className="flex items-center text-sm">
                                                    <DollarSign className="mr-1 h-4 w-4 text-gray-500" />
                                                    <span className="font-medium">{delivery.totalPrice.toLocaleString('vi-VN')} VNĐ</span>
                                                </div>
                                                {delivery.items && (
                                                    <div className="flex items-center text-sm">
                                                        <span className="font-medium">{delivery.items.length} món</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Existing Deliveries Queue từ DB */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                        <p className="text-gray-600">Đang tải danh sách deliveries...</p>
                    </div>
                ) : deliveries.length === 0 && deliveryNotifications.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <div className="rounded-full bg-gray-100 p-6 mb-4">
                                <Drone className="h-12 w-12 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Không có đơn hàng chờ xử lý
                            </h3>
                            <p className="text-sm text-gray-500">
                                Tất cả đơn hàng đã được xử lý
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold">
                            Deliveries chờ assign drone - {deliveries.length} đơn
                        </h2>
                        <div className="grid gap-4">
                            {deliveries.map((delivery) => (
                                <Card
                                    key={delivery.id}
                                    className="cursor-pointer transition-all hover:shadow-lg border-blue-200"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('Navigating to order:', delivery.orderId);
                                        navigate(`/order/${delivery.orderId}`);
                                    }}
                                >
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    📦 Order: {delivery.orderId.slice(0, 8)}...
                                                    <Badge className="bg-yellow-500">{delivery.status}</Badge>
                                                </CardTitle>
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <Clock className="mr-1 h-4 w-4" />
                                                    {format(new Date(delivery.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                            <div className="flex items-start space-x-2">
                                                <User className="h-5 w-5 text-blue-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {delivery.customerName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {delivery.customerPhone}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-2">
                                                <Store className="h-5 w-5 text-orange-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {delivery.restaurantName}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {delivery.restaurantAddress}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-2">
                                                <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">Địa chỉ giao</p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {delivery.customerAddress}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-2">
                                                <Clock className="h-5 w-5 text-purple-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {delivery.distance.toFixed(1)} km
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        ~{delivery.estimatedTime} phút
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center space-x-4 rounded-lg bg-blue-50 p-3">
                                            <div className="flex items-center text-sm">
                                                <Drone className="mr-1 h-4 w-4 text-blue-500" />
                                                <span className="font-medium">
                                                    {delivery.droneId ? `Drone: ${delivery.droneId.slice(0, 8)}` : 'Chưa assign drone'}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DispatchQueuePage;

