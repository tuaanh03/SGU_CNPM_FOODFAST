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
    Drone as DroneIcon,
    LogOut,
    MapPin,
    Store,
    User,
    Clock,
    Navigation,
    Battery,
    Zap,
    TrendingUp,
    Activity
} from "lucide-react";
import type { Order, Drone } from "@/services/drone.service";
import { deliveryService } from "@/services/delivery.service";
import { toast } from "sonner";
import DroneTrackingMap from "@/components/DroneTrackingMap";

const RouteTrackingPage = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { joinOrder, leaveOrder, realtimeDronePositions, currentOtps } = useAdminSocket();

    // Get order and drone from URL state or localStorage
    const [order, setOrder] = useState<Order | null>(null);
    const [drone, setDrone] = useState<Drone | null>(null);
    const [droneProgress, setDroneProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [delivery, setDelivery] = useState<any>(null);
    const [currentOtp, setCurrentOtp] = useState<string>("");
    const [realtimeDronePosition, setRealtimeDronePosition] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        const fetchDelivery = async () => {
            if (!orderId) {
                setIsLoading(false);
                return;
            }

            try {
                // Fetch delivery from API
                const response = await deliveryService.getDeliveryByOrderId(orderId);

                if (response.success) {
                    const deliveryData = response.data;
                    setDelivery(deliveryData);

                    // Map delivery to order format
                    setOrder({
                        id: deliveryData.orderId,
                        orderCode: deliveryData.orderId.slice(0, 8).toUpperCase(),
                        customerName: deliveryData.customerName,
                        customerPhone: deliveryData.customerPhone,
                        customerAddress: deliveryData.customerAddress,
                        restaurantName: deliveryData.restaurantName,
                        restaurantAddress: deliveryData.restaurantAddress,
                        status: deliveryData.status,
                        totalAmount: 0,
                        items: [],
                        createdAt: deliveryData.createdAt,
                        route: {
                            distance: deliveryData.distance,
                            estimatedTime: deliveryData.estimatedTime,
                            waypoints: [
                                {
                                    type: 'restaurant',
                                    address: deliveryData.restaurantAddress,
                                    lat: deliveryData.restaurantLat,
                                    lng: deliveryData.restaurantLng
                                },
                                {
                                    type: 'customer',
                                    address: deliveryData.customerAddress,
                                    lat: deliveryData.customerLat,
                                    lng: deliveryData.customerLng
                                }
                            ]
                        }
                    } as any);

                    // Get drone info
                    if (deliveryData.drone) {
                        setDrone({
                            id: deliveryData.drone.id,
                            name: deliveryData.drone.name,
                            model: deliveryData.drone.model,
                            battery: deliveryData.drone.battery,
                            status: deliveryData.drone.status,
                            currentLat: deliveryData.drone.currentLat,
                            currentLng: deliveryData.drone.currentLng
                        } as any);
                    } else {
                        // Fallback to localStorage
                        const savedDrone = localStorage.getItem(`drone_for_order_${orderId}`);
                        if (savedDrone) {
                            setDrone(JSON.parse(savedDrone));
                        }
                    }
                } else {
                    toast.error('Không tìm thấy thông tin delivery cho order này');
                }
            } catch (error) {
                console.error('Error fetching delivery:', error);
                toast.error('Không thể tải thông tin đơn hàng');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDelivery();

        // Simulate drone movement progress
        const interval = setInterval(() => {
            setDroneProgress(prev => {
                if (prev >= 100) return 100;
                return prev + 0.5;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [orderId]);

    // Join order room và listen cho realtime updates
    useEffect(() => {
        if (!orderId) return;

        console.log('🔌 [RouteTrackingPage] Joining order:', orderId);
        joinOrder(orderId);

        return () => {
            console.log('🔌 [RouteTrackingPage] Leaving order:', orderId);
            leaveOrder(orderId);
        };
    }, [orderId, joinOrder, leaveOrder]);

    // Update OTP từ AdminSocketContext
    useEffect(() => {
        if (orderId && currentOtps[orderId]) {
            setCurrentOtp(currentOtps[orderId]);
            console.log(`🔐 [RouteTrackingPage] OTP updated: ${currentOtps[orderId]}`);
        }
    }, [orderId, currentOtps]);

    // Update drone position từ AdminSocketContext
    useEffect(() => {
        if (orderId && realtimeDronePositions[orderId]) {
            const position = realtimeDronePositions[orderId];
            console.log(`🚁 [RouteTrackingPage] Drone position updated: [${position.lat}, ${position.lng}]`);

            setRealtimeDronePosition(position);

            // Update delivery with new drone position
            setDelivery((prev: any) => ({
                ...prev,
                drone: {
                    ...prev?.drone,
                    currentLat: position.lat,
                    currentLng: position.lng
                }
            }));

            // Update drone state for other components
            setDrone((prev: any) => prev ? {
                ...prev,
                currentLat: position.lat,
                currentLng: position.lng
            } : null);
        }
    }, [orderId, realtimeDronePositions]);

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

    // Show loading state while checking order
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-lg">Đang tải...</div>
            </div>
        );
    }

    // Only redirect if order not found after loading
    if (!order) {
        navigate('/dispatch');
        return null;
    }

    const restaurantWaypoint = order.route?.waypoints.find(w => w.type === 'restaurant');
    const customerWaypoint = order.route?.waypoints.find(w => w.type === 'customer');
    const estimatedArrival = order.route ? new Date(Date.now() + order.route.estimatedTime * 60000) : null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/order/${orderId}`)}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="rounded-lg bg-blue-600 p-2">
                                <DroneIcon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Theo Dõi Lộ Trình
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {order.orderCode} - {drone ? drone.name : 'Chưa assign drone'}
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
            <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column - Map */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* DroneTrackingMap with Mapbox */}
                        {delivery && restaurantWaypoint && customerWaypoint && drone && (
                            <DroneTrackingMap
                                droneLocation={{
                                    lat: realtimeDronePosition?.lat || delivery.drone?.currentLat || drone.currentLat || restaurantWaypoint.lat,
                                    lng: realtimeDronePosition?.lng || delivery.drone?.currentLng || drone.currentLng || restaurantWaypoint.lng
                                }}
                                restaurantLocation={{
                                    lat: restaurantWaypoint.lat,
                                    lng: restaurantWaypoint.lng,
                                    name: order.restaurantName
                                }}
                                customerLocation={{
                                    lat: customerWaypoint.lat,
                                    lng: customerWaypoint.lng,
                                    address: order.customerAddress
                                }}
                                homeBaseLocation={{
                                    lat: drone.currentLat || restaurantWaypoint.lat,
                                    lng: drone.currentLng || restaurantWaypoint.lng
                                }}
                                deliveryStatus={delivery.status}
                            />
                        )}

                        {/* Large Map Card (Fallback if no delivery data) */}
                        {!delivery && (
                        <Card className="overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                                <CardTitle className="flex items-center justify-between">
                                    <span>Bản Đồ Lộ Trình</span>
                                    <Badge className="bg-white text-blue-700">
                                        {droneProgress < 100 ? 'Đang Giao' : 'Hoàn Thành'}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {/* Large Map Visualization */}
                                <div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-green-50">
                                    {/* Grid pattern */}
                                    <svg className="absolute inset-0 w-full h-full opacity-20">
                                        <defs>
                                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="1"/>
                                            </pattern>
                                        </defs>
                                        <rect width="100%" height="100%" fill="url(#grid)" />
                                    </svg>

                                    {/* Route Line */}
                                    <svg className="absolute inset-0 w-full h-full">
                                        <defs>
                                            <marker
                                                id="arrowhead"
                                                markerWidth="10"
                                                markerHeight="10"
                                                refX="5"
                                                refY="3"
                                                orient="auto"
                                            >
                                                <polygon points="0 0, 10 3, 0 6" fill="#3B82F6" />
                                            </marker>
                                        </defs>
                                        <line
                                            x1="15%"
                                            y1="30%"
                                            x2="85%"
                                            y2="70%"
                                            stroke="#3B82F6"
                                            strokeWidth="4"
                                            strokeDasharray="15,10"
                                            markerEnd="url(#arrowhead)"
                                        />
                                    </svg>

                                    {/* Restaurant Marker */}
                                    <div className="absolute left-[15%] top-[30%] transform -translate-x-1/2 -translate-y-1/2 z-10">
                                        <div className="relative">
                                            <div className="bg-orange-500 rounded-full p-4 shadow-2xl border-4 border-white animate-pulse">
                                                <Store className="h-8 w-8 text-white" />
                                            </div>
                                            <div className="absolute top-full mt-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                                <div className="bg-white rounded-lg shadow-lg px-3 py-2 border border-orange-200">
                                                    <Badge className="bg-orange-500 mb-1">Điểm Đi</Badge>
                                                    <p className="text-xs font-semibold text-gray-900">{order.restaurantName}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Drone Position - Animated */}
                                    <div
                                        className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
                                        style={{
                                            left: `${15 + (70 * droneProgress / 100)}%`,
                                            top: `${30 + (40 * droneProgress / 100)}%`
                                        }}
                                    >
                                        <div className="relative">
                                            <div className="bg-blue-500 rounded-full p-4 shadow-2xl border-4 border-white animate-bounce">
                                                <Navigation className="h-8 w-8 text-white transform rotate-45" />
                                            </div>
                                            {/* Drone Info Popup */}
                                            <div className="absolute top-full mt-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                                <div className="bg-white rounded-lg shadow-xl px-4 py-3 border border-blue-200">
                                                    <Badge className="bg-blue-500 mb-2">{drone?.name || 'Drone'}</Badge>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-gray-600">Tiến độ: {droneProgress.toFixed(0)}%</p>
                                                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 transition-all duration-1000"
                                                                style={{ width: `${droneProgress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Marker */}
                                    <div className="absolute left-[85%] top-[70%] transform -translate-x-1/2 -translate-y-1/2 z-10">
                                        <div className="relative">
                                            <div className="bg-green-500 rounded-full p-4 shadow-2xl border-4 border-white animate-pulse">
                                                <User className="h-8 w-8 text-white" />
                                            </div>
                                            <div className="absolute top-full mt-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                                                <div className="bg-white rounded-lg shadow-lg px-3 py-2 border border-green-200">
                                                    <Badge className="bg-green-500 mb-1">Điểm Đến</Badge>
                                                    <p className="text-xs font-semibold text-gray-900">{order.customerName}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Indicator */}
                                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
                                        <div className="bg-white rounded-full shadow-2xl px-6 py-3 border-2 border-blue-200">
                                            <div className="flex items-center space-x-3">
                                                <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
                                                <div>
                                                    <p className="text-xs text-gray-500">Tiến độ giao hàng</p>
                                                    <p className="text-lg font-bold text-blue-600">{droneProgress.toFixed(1)}%</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        )}

                        {/* Route Information */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-start space-x-3">
                                        <div className="bg-orange-100 rounded-full p-3">
                                            <Store className="h-6 w-6 text-orange-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold mb-1">Điểm Đi (Nhà Hàng)</h4>
                                            <p className="text-sm font-medium text-gray-900">{order.restaurantName}</p>
                                            <p className="text-xs text-gray-600 mt-1">{restaurantWaypoint?.address}</p>
                                            {restaurantWaypoint && (
                                                <div className="mt-2 text-xs text-gray-500 font-mono">
                                                    <span>{restaurantWaypoint.lat.toFixed(6)}, {restaurantWaypoint.lng.toFixed(6)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-start space-x-3">
                                        <div className="bg-green-100 rounded-full p-3">
                                            <User className="h-6 w-6 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold mb-1">Điểm Đến (Khách Hàng)</h4>
                                            <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                                            <p className="text-xs text-gray-600 mt-1">{customerWaypoint?.address}</p>
                                            {customerWaypoint && (
                                                <div className="mt-2 text-xs text-gray-500 font-mono">
                                                    <span>{customerWaypoint.lat.toFixed(6)}, {customerWaypoint.lng.toFixed(6)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Right Column - Details */}
                    <div className="space-y-6">
                        {/* Drone Status */}
                        {drone && (
                            <Card className="border-blue-200 bg-blue-50">
                                <CardHeader>
                                    <CardTitle className="flex items-center text-blue-900">
                                        <DroneIcon className="mr-2 h-5 w-5" />
                                        Thông Tin Drone
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <p className="text-sm text-gray-600">Tên</p>
                                        <p className="font-semibold text-blue-900">{drone.name}</p>
                                    </div>
                                    <Separator />
                                    <div>
                                        <p className="text-sm text-gray-600">Model</p>
                                        <p className="font-semibold text-blue-900">{drone.model}</p>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <Battery className="h-5 w-5 text-green-600" />
                                            <span className="text-sm text-gray-600">Pin</span>
                                        </div>
                                        <span className="text-lg font-bold text-green-600">{drone.battery}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${drone.battery}%` }}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* OTP Display Card */}
                        {currentOtp && delivery?.status === 'PICKING_UP' && (
                            <Card className="border-green-200 bg-green-50 animate-pulse">
                                <CardHeader>
                                    <CardTitle className="flex items-center text-green-900">
                                        🔐 Mã OTP Nhận Hàng
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-center p-4">
                                        <p className="text-sm text-gray-600 mb-2">Mã xác nhận cho merchant:</p>
                                        <p className="text-4xl font-bold text-green-700 tracking-widest mb-2">
                                            {currentOtp}
                                        </p>
                                        <p className="text-xs text-gray-500">Hết hạn sau 30 giây</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Delivery Stats */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Thống Kê Giao Hàng</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {order.route && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <MapPin className="h-5 w-5 text-blue-600" />
                                                <span className="text-sm text-gray-600">Khoảng cách</span>
                                            </div>
                                            <span className="text-lg font-bold text-blue-600">{order.route.distance} km</span>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Clock className="h-5 w-5 text-purple-600" />
                                                <span className="text-sm text-gray-600">Thời gian dự kiến</span>
                                            </div>
                                            <span className="text-lg font-bold text-purple-600">~{order.route.estimatedTime} phút</span>
                                        </div>
                                        {estimatedArrival && (
                                            <>
                                                <Separator />
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Zap className="h-5 w-5 text-orange-600" />
                                                        <span className="text-sm text-gray-600">Giờ đến dự kiến</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-orange-600">
                                                        {estimatedArrival.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <TrendingUp className="h-5 w-5 text-green-600" />
                                                <span className="text-sm text-gray-600">Tiến độ</span>
                                            </div>
                                            <span className="text-lg font-bold text-green-600">{droneProgress.toFixed(0)}%</span>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Order Summary */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Thông Tin Đơn Hàng</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-sm text-gray-600">Mã đơn</p>
                                    <p className="font-semibold">{order.orderCode}</p>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm text-gray-600">Khách hàng</p>
                                    <p className="font-semibold">{order.customerName}</p>
                                    <p className="text-xs text-gray-500">{order.customerPhone}</p>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm text-gray-600">Tổng tiền</p>
                                    <p className="text-xl font-bold text-blue-600">{formatCurrency(order.totalAmount)}</p>
                                </div>
                                <Separator />
                                <div>
                                    <p className="text-sm text-gray-600 mb-2">Món ăn ({order.items.length})</p>
                                    {order.items.map((item, index) => (
                                        <p key={index} className="text-xs text-gray-700">
                                            • {item.productName} x{item.quantity}
                                        </p>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default RouteTrackingPage;

