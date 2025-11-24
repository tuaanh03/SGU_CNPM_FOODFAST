import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { useAdminSocket } from "@/contexts/AdminSocketContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    Drone,
    LogOut,
    MapPin,
    Store,
    User,
    Clock,
    CheckCircle,
    XCircle
} from "lucide-react";
import type { Drone as DroneType } from "@/services/drone.service";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import DroneSelectionDialog from "@/components/DroneSelectionDialog";
import OrderMapSection from "@/components/OrderMapSection";
import { deliveryService } from "@/services/delivery.service";
import API_BASE_URL from "@/config/api";

const OrderDetailPage = () => {
    const { joinOrder, leaveOrder } = useAdminSocket();
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [nearbyDrones, setNearbyDrones] = useState<any[]>([]);
    const [pickupLocation, setPickupLocation] = useState<any>(null);
    const [deliveryDestination, setDeliveryDestination] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);
    const [showDroneSelection, setShowDroneSelection] = useState(false);
    const [suitableDrones, setSuitableDrones] = useState<DroneType[]>([]);
    const [selectedDrone, setSelectedDrone] = useState<DroneType | null>(null);

    // Fetch delivery by orderId
    useEffect(() => {
        const fetchDelivery = async () => {
            if (!orderId) {
                navigate('/dispatch');
                return;
            }

            try {
                setLoading(true);
                const response = await deliveryService.getDeliveryByOrderId(orderId);

                if (response.success) {
                    // Map delivery to order format for compatibility với UI hiện tại
                    setOrder({
                        id: response.data.orderId,
                        orderCode: response.data.orderId.slice(0, 8).toUpperCase(),
                        customerName: response.data.customerName,
                        customerPhone: response.data.customerPhone,
                        customerAddress: response.data.customerAddress,
                        restaurantName: response.data.restaurantName,
                        restaurantAddress: response.data.restaurantAddress,
                        status: response.data.status,
                        totalAmount: 0, // Delivery không có totalAmount
                        items: [], // Delivery không có items detail
                        createdAt: response.data.createdAt,
                        route: {
                            distance: response.data.distance,
                            estimatedTime: response.data.estimatedTime,
                            waypoints: [
                                {
                                    type: 'restaurant',
                                    address: response.data.restaurantAddress,
                                    lat: response.data.restaurantLat,
                                    lng: response.data.restaurantLng
                                },
                                {
                                    type: 'customer',
                                    address: response.data.customerAddress,
                                    lat: response.data.customerLat,
                                    lng: response.data.customerLng
                                }
                            ]
                        }
                    });

                    // Set pickup and delivery locations for map
                    setPickupLocation({
                        lat: response.data.restaurantLat,
                        lng: response.data.restaurantLng,
                        restaurantName: response.data.restaurantName,
                        address: response.data.restaurantAddress
                    });

                    setDeliveryDestination({
                        lat: response.data.customerLat,
                        lng: response.data.customerLng,
                        address: response.data.customerAddress
                    });

                    // Fetch nearby drones for this restaurant location
                    try {
                        const dronesResponse = await fetch(
                            `${API_BASE_URL}/drones/nearby?lat=${response.data.restaurantLat}&lng=${response.data.restaurantLng}&radius=10`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('system_admin_token')}`,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        if (dronesResponse.ok) {
                            const dronesData = await dronesResponse.json();
                            if (dronesData.success && dronesData.data) {
                                setNearbyDrones(dronesData.data);
                                console.log(`📍 Found ${dronesData.data.length} nearby drones`);
                            }
                        } else {
                            console.error('Failed to fetch nearby drones:', dronesResponse.status);
                        }
                    } catch (droneError) {
                        console.error('Error fetching nearby drones:', droneError);
                    }
                }
            } catch (error: any) {
                console.error('Error fetching delivery:', error);
                toast.error('Không thể tải thông tin đơn hàng');
                navigate('/dispatch');
            } finally {
                setLoading(false);
            }
        };

        fetchDelivery();
    }, [orderId, navigate]);

    // Join order room để nhận realtime updates
    useEffect(() => {
        if (!orderId) return;

        console.log('🔌 [OrderDetailPage] Joining order:', orderId);
        joinOrder(orderId);

        return () => {
            console.log('🔌 [OrderDetailPage] Leaving order:', orderId);
            leaveOrder(orderId);
        };
    }, [orderId, joinOrder, leaveOrder]);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const handleApprove = () => {
        if (!order) return;

        // Use nearbyDrones fetched from API
        setSuitableDrones(nearbyDrones);

        if (nearbyDrones.length === 0) {
            toast.error("Không có drone khả dụng gần nhà hàng!");
            return;
        }

        setShowDroneSelection(true);
    };

    const handleReject = () => {
        if (!order) return;

        toast.error("Đơn hàng đã bị từ chối!");
        setOrder({ ...order, status: 'REJECTED' });

        setTimeout(() => {
            navigate('/dispatch');
        }, 1500);
    };

    const handleDroneSelect = async (drone: any) => {
        if (!orderId) return;

        try {
            // Call API to assign drone to delivery
            const response = await deliveryService.assignDrone(orderId, drone.id);

            if (response.success) {
                setSelectedDrone(drone);
                toast.success(`Đã gán ${drone.name} cho đơn hàng thành công!`);

                // Update order status locally
                if (order) {
                    setOrder({ ...order, status: 'ASSIGNED' });
                }

                // Save to localStorage for tracking
                localStorage.setItem(`drone_for_order_${orderId}`, JSON.stringify(drone));

                // Navigate to tracking page after short delay
                setTimeout(() => {
                    navigate(`/order/${orderId}/tracking`);
                }, 1000);
            } else {
                toast.error(response.message || 'Không thể gán drone');
            }
        } catch (error: any) {
            console.error('Error assigning drone:', error);
            toast.error(error.message || 'Có lỗi xảy ra khi gán drone');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                    <p className="text-gray-600">Đang tải thông tin đơn hàng...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">Không tìm thấy đơn hàng</p>
                    <Button onClick={() => navigate('/dispatch')}>
                        Quay lại Dispatch Queue
                    </Button>
                </div>
            </div>
        );
    }

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
                                onClick={() => navigate("/dispatch")}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="rounded-lg bg-blue-600 p-2">
                                <Drone className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Chi Tiết Đơn Hàng
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {order.orderCode}
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
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column - Order Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Order Info Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Thông Tin Đơn Hàng</CardTitle>
                                    <Badge className={
                                        order.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                                        order.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                    }>
                                        {order.status === 'PENDING_APPROVAL' ? 'Chờ Phê Duyệt' :
                                         order.status === 'APPROVED' ? 'Đã Phê Duyệt' : 'Đã Từ Chối'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-3">
                                    <Clock className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <p className="text-sm font-medium">Thời gian đặt</p>
                                        <p className="text-sm text-gray-600">
                                            {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                                        </p>
                                    </div>
                                </div>
                                <Separator />
                                <div className="flex items-start space-x-3">
                                    <User className="h-5 w-5 text-blue-600 mt-1" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Khách hàng</p>
                                        <p className="text-sm text-gray-900">{order.customerName}</p>
                                        <p className="text-sm text-gray-600">{order.customerPhone}</p>
                                        <p className="text-sm text-gray-600 mt-1">{order.customerAddress}</p>
                                    </div>
                                </div>
                                <Separator />
                                <div className="flex items-start space-x-3">
                                    <Store className="h-5 w-5 text-orange-600 mt-1" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Nhà hàng</p>
                                        <p className="text-sm text-gray-900">{order.restaurantName}</p>
                                        <p className="text-sm text-gray-600">{order.restaurantAddress}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order Items Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Chi Tiết Món Ăn</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {order.items && order.items.length > 0 ? (
                                        <>
                                            {order.items.map((item: any) => (
                                                <div key={item.id} className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{item.productName}</p>
                                                        <p className="text-xs text-gray-500">SL: {item.quantity}</p>
                                                    </div>
                                                    <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
                                                </div>
                                            ))}
                                            <Separator />
                                            <div className="flex items-center justify-between">
                                                <p className="text-base font-bold">Tổng cộng</p>
                                                <p className="text-base font-bold text-blue-600">
                                                    {formatCurrency(order.totalAmount)}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500">Không có thông tin món ăn</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Map Section - Show pickup, delivery and nearby drones */}
                        {pickupLocation && (
                            <OrderMapSection
                                pickupLocation={pickupLocation}
                                deliveryDestination={deliveryDestination}
                                drones={nearbyDrones}
                            />
                        )}

                        {/* Nearby Drones List for Assignment */}
                        {nearbyDrones.length > 0 && !selectedDrone && order.status === 'PENDING' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Drone className="h-5 w-5 text-blue-600" />
                                        Drones khả dụng gần nhà hàng ({nearbyDrones.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {nearbyDrones.map((drone: any) => (
                                            <div
                                                key={drone.id}
                                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                                                onClick={() => handleDroneSelect(drone)}
                                            >
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900">{drone.name}</p>
                                                    <p className="text-sm text-gray-600">{drone.model}</p>
                                                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                        <span>📍 {drone.distance} km</span>
                                                        <span>🔋 {drone.battery}%</span>
                                                        <span>📦 {drone.maxPayload} kg</span>
                                                    </div>
                                                </div>
                                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                    Chọn Drone
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Selected Drone Card */}
                        {selectedDrone && (
                            <Card className="border-green-200 bg-green-50">
                                <CardHeader>
                                    <CardTitle className="flex items-center text-green-900">
                                        <CheckCircle className="mr-2 h-5 w-5" />
                                        Drone Đã Chọn
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div>
                                            <p className="text-sm text-gray-600">Tên Drone</p>
                                            <p className="font-medium text-green-900">{selectedDrone.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Model</p>
                                            <p className="font-medium text-green-900">{selectedDrone.model}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Pin</p>
                                            <p className="font-medium text-green-900">{selectedDrone.battery}%</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Khoảng cách</p>
                                            <p className="font-medium text-green-900">
                                                {selectedDrone.distanceFromRestaurant?.toFixed(1)} km
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full mt-4"
                                        onClick={() => navigate(`/order/${orderId}/tracking`)}
                                    >
                                        <MapPin className="mr-2 h-4 w-4" />
                                        Xem Bản Đồ Lộ Trình
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right Column - Route Info & Actions */}
                    <div className="space-y-6">
                        {/* Route Info Card */}
                        {order.route && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <MapPin className="mr-2 h-5 w-5" />
                                        Thông Tin Lộ Trình
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Khoảng cách</p>
                                        <p className="text-2xl font-bold text-blue-600">
                                            {order.route.distance} km
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Thời gian ước tính</p>
                                        <p className="text-2xl font-bold text-green-600">
                                            ~{order.route.estimatedTime} phút
                                        </p>
                                    </div>
                                    <Separator />
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Điểm đi</p>
                                        <div className="flex items-start space-x-2">
                                            <Store className="h-4 w-4 text-orange-600 mt-1" />
                                            <p className="text-xs text-gray-600">
                                                {order.route.waypoints.find((w: any) => w.type === 'restaurant')?.address}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Điểm đến</p>
                                        <div className="flex items-start space-x-2">
                                            <MapPin className="h-4 w-4 text-green-600 mt-1" />
                                            <p className="text-xs text-gray-600">
                                                {order.route.waypoints.find((w: any) => w.type === 'customer')?.address}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions Card */}
                        {order.status === 'PENDING_APPROVAL' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Hành Động</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button
                                        className="w-full"
                                        onClick={handleApprove}
                                    >
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Phê Duyệt & Chọn Drone
                                    </Button>
                                    <Button
                                        className="w-full"
                                        variant="destructive"
                                        onClick={handleReject}
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Từ Chối Đơn Hàng
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {order.status === 'APPROVED' && !selectedDrone && (
                            <Card className="border-green-200 bg-green-50">
                                <CardContent className="pt-6 text-center">
                                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                                    <p className="font-medium text-green-900">Đơn hàng đã được phê duyệt</p>
                                </CardContent>
                            </Card>
                        )}

                        {order.status === 'REJECTED' && (
                            <Card className="border-red-200 bg-red-50">
                                <CardContent className="pt-6 text-center">
                                    <XCircle className="h-12 w-12 text-red-600 mx-auto mb-2" />
                                    <p className="font-medium text-red-900">Đơn hàng đã bị từ chối</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>

            {/* Drone Selection Dialog */}
            <DroneSelectionDialog
                open={showDroneSelection}
                onClose={() => setShowDroneSelection(false)}
                drones={suitableDrones}
                onSelect={handleDroneSelect}
            />
        </div>
    );
};

export default OrderDetailPage;

