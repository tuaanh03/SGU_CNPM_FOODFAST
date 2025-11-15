import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/contexts/auth-context";
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
import { mockOrders, getSuitableDrones } from "@/services/mockData";
import type { Drone as DroneType } from "@/services/mockData";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import DroneSelectionDialog from "@/components/DroneSelectionDialog";

const OrderDetailPage = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [order, setOrder] = useState(() => mockOrders.find(o => o.id === orderId));
    const [showDroneSelection, setShowDroneSelection] = useState(false);
    const [suitableDrones, setSuitableDrones] = useState<DroneType[]>([]);
    const [selectedDrone, setSelectedDrone] = useState<DroneType | null>(null);

    useEffect(() => {
        if (!order) {
            navigate('/dispatch');
        }
    }, [order, navigate]);

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

        // Get suitable drones for this order
        const drones = getSuitableDrones(order);
        setSuitableDrones(drones);

        if (drones.length === 0) {
            toast.error("Không có drone phù hợp cho đơn hàng này!");
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

    const handleDroneSelect = (drone: DroneType) => {
        setSelectedDrone(drone);
        setShowDroneSelection(false);
        toast.success(`Đã chọn ${drone.name} cho đơn hàng!`);

        // Update order status
        if (order) {
            setOrder({ ...order, status: 'APPROVED' });
        }

        // Save drone to localStorage
        localStorage.setItem(`drone_for_order_${orderId}`, JSON.stringify(drone));

        // Navigate to tracking page
        setTimeout(() => {
            navigate(`/order/${orderId}/tracking`);
        }, 500);
    };

    if (!order) {
        return null;
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
                                    {order.items.map((item) => (
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
                                </div>
                            </CardContent>
                        </Card>

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
                                                {order.route.waypoints.find(w => w.type === 'restaurant')?.address}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Điểm đến</p>
                                        <div className="flex items-start space-x-2">
                                            <MapPin className="h-4 w-4 text-green-600 mt-1" />
                                            <p className="text-xs text-gray-600">
                                                {order.route.waypoints.find(w => w.type === 'customer')?.address}
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

