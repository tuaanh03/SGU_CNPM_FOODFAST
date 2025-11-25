import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Drone, LogOut, MapPin, Store, Clock, Navigation } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { deliveryService } from "@/services/delivery.service";

const DeliveryManagementPage = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActiveDeliveries();
    }, []);

    const fetchActiveDeliveries = async () => {
        try {
            setLoading(true);
            // Fetch deliveries with status ASSIGNED, PICKING_UP, IN_TRANSIT
            const response = await deliveryService.getAllDeliveries({});
            if (response.success) {
                const activeDeliveries = response.data.filter((d: any) =>
                    ['ASSIGNED', 'PICKING_UP', 'IN_TRANSIT'].includes(d.status)
                );
                setDeliveries(activeDeliveries);
            }
        } catch (error) {
            console.error('Error fetching deliveries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { label: string; className: string }> = {
            'ASSIGNED': { label: 'Đã gán drone', className: 'bg-blue-100 text-blue-800' },
            'PICKING_UP': { label: 'Đang đến lấy hàng', className: 'bg-yellow-100 text-yellow-800' },
            'IN_TRANSIT': { label: 'Đang giao hàng', className: 'bg-green-100 text-green-800' },
        };
        return statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
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
                            <div className="rounded-lg bg-green-600 p-2">
                                <Navigation className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Quản lý Giao hàng
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {deliveries.length} đơn hàng đang giao
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
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent mb-4"></div>
                        <p className="text-gray-600">Đang tải danh sách giao hàng...</p>
                    </div>
                ) : deliveries.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <div className="rounded-full bg-gray-100 p-6 mb-4">
                                <Drone className="h-12 w-12 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Không có đơn hàng đang giao
                            </h3>
                            <p className="text-sm text-gray-500">
                                Tất cả đơn hàng đã được giao hoặc chưa được gán drone
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {deliveries.map((delivery) => {
                            const statusInfo = getStatusBadge(delivery.status);
                            return (
                                <Card
                                    key={delivery.id}
                                    className="cursor-pointer transition-all hover:shadow-lg border-green-200"
                                    onClick={() => navigate(`/order/${delivery.orderId}/tracking`)}
                                >
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    🚁 Order: {delivery.orderId.slice(0, 8)}...
                                                    <Badge className={statusInfo.className}>
                                                        {statusInfo.label}
                                                    </Badge>
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
                                                <Drone className="h-5 w-5 text-blue-600 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {delivery.drone?.name || 'N/A'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        🔋 {delivery.drone?.battery || 0}%
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
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {delivery.customerName}
                                                    </p>
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
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default DeliveryManagementPage;

