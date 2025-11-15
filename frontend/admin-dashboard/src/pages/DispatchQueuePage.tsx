import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Drone, LogOut, MapPin, Store, User, Clock, DollarSign } from "lucide-react";
import { mockOrders } from "@/services/mockData";
import type { Order } from "@/services/mockData";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

const DispatchQueuePage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [orders] = useState<Order[]>(
        mockOrders.filter(o => o.status === 'PENDING_APPROVAL')
    );

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING_APPROVAL':
                return 'bg-yellow-100 text-yellow-800';
            case 'APPROVED':
                return 'bg-green-100 text-green-800';
            case 'REJECTED':
                return 'bg-red-100 text-red-800';
            case 'IN_TRANSIT':
                return 'bg-blue-100 text-blue-800';
            case 'DELIVERED':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'PENDING_APPROVAL':
                return 'Chờ Phê Duyệt';
            case 'APPROVED':
                return 'Đã Phê Duyệt';
            case 'REJECTED':
                return 'Đã Từ Chối';
            case 'IN_TRANSIT':
                return 'Đang Giao';
            case 'DELIVERED':
                return 'Đã Giao';
            default:
                return status;
        }
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
                                    {user?.name} - {orders.length} đơn hàng chờ xử lý
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
                {orders.length === 0 ? (
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
                    <div className="grid gap-4">
                        {orders.map((order) => (
                            <Card
                                key={order.id}
                                className="cursor-pointer transition-all hover:shadow-lg"
                                onClick={() => navigate(`/order/${order.id}`)}
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg">
                                                {order.orderCode}
                                            </CardTitle>
                                            <div className="flex items-center text-sm text-gray-500">
                                                <Clock className="mr-1 h-4 w-4" />
                                                {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                            </div>
                                        </div>
                                        <Badge className={getStatusColor(order.status)}>
                                            {getStatusText(order.status)}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                        <div className="flex items-start space-x-2">
                                            <User className="h-5 w-5 text-blue-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {order.customerName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {order.customerPhone}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <Store className="h-5 w-5 text-orange-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {order.restaurantName}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {order.restaurantAddress}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Địa chỉ giao</p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {order.customerAddress}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <DollarSign className="h-5 w-5 text-purple-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {formatCurrency(order.totalAmount)}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {order.items.length} món
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    {order.route && (
                                        <div className="mt-4 flex items-center space-x-4 rounded-lg bg-gray-50 p-3">
                                            <div className="flex items-center text-sm">
                                                <MapPin className="mr-1 h-4 w-4 text-gray-500" />
                                                <span className="font-medium">{order.route.distance} km</span>
                                            </div>
                                            <div className="flex items-center text-sm">
                                                <Clock className="mr-1 h-4 w-4 text-gray-500" />
                                                <span className="font-medium">~{order.route.estimatedTime} phút</span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default DispatchQueuePage;

