import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Drone, Clock, CheckCircle, LogOut } from "lucide-react";
import { deliveryService } from "@/services/delivery.service";

const DashboardPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({
        pendingOrders: 0,
        inTransit: 0,
        delivered: 0,
        availableDrones: 0,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await deliveryService.getAllDeliveries({});
                if (response.success) {
                    const deliveries = response.data;
                    setStats({
                        pendingOrders: deliveries.filter((d: any) => d.status === 'PENDING').length,
                        inTransit: deliveries.filter((d: any) => ['ASSIGNED', 'PICKING_UP', 'IN_TRANSIT'].includes(d.status)).length,
                        delivered: deliveries.filter((d: any) => d.status === 'DELIVERED').length,
                        availableDrones: 0, // TODO: Fetch from drone API
                    });
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };

        fetchStats();
    }, []);

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
                            <div className="rounded-lg bg-blue-600 p-2">
                                <Drone className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    Drone Delivery Admin
                                </h1>
                                <p className="text-sm text-gray-500">
                                    Xin chào, {user?.name}
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
                {/* Stats Grid */}
                <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Chờ Phê Duyệt
                            </CardTitle>
                            <Clock className="h-4 w-4 text-yellow-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
                            <p className="text-xs text-muted-foreground">
                                Đơn hàng cần xử lý
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Đang Giao Hàng
                            </CardTitle>
                            <Package className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.inTransit}</div>
                            <p className="text-xs text-muted-foreground">
                                Đơn hàng đang vận chuyển
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Đã Giao
                            </CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.delivered}</div>
                            <p className="text-xs text-muted-foreground">
                                Hoàn thành hôm nay
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Drone Sẵn Sàng
                            </CardTitle>
                            <Drone className="h-4 w-4 text-purple-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.availableDrones}</div>
                            <p className="text-xs text-muted-foreground">
                                Drone có thể sử dụng
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="cursor-pointer transition-all hover:shadow-lg" onClick={() => navigate("/dispatch")}>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Package className="mr-2 h-5 w-5" />
                                Hàng Đợi Dispatch
                            </CardTitle>
                            <CardDescription>
                                Xem và quản lý các đơn hàng chờ phê duyệt
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full">
                                Xem Hàng Đợi
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer transition-all hover:shadow-lg" onClick={() => navigate("/deliveries")}>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Clock className="mr-2 h-5 w-5" />
                                Quản Lý Giao Hàng
                            </CardTitle>
                            <CardDescription>
                                Theo dõi các đơn hàng đang được giao
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full" variant="default">
                                Xem Giao Hàng
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer transition-all hover:shadow-lg" onClick={() => navigate("/completed-deliveries")}>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <CheckCircle className="mr-2 h-5 w-5" />
                                Đơn Đã Giao
                            </CardTitle>
                            <CardDescription>
                                Xem lịch sử các đơn hàng đã hoàn thành
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full" variant="default">
                                Xem Lịch Sử
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="cursor-pointer transition-all hover:shadow-lg" onClick={() => navigate("/drones")}>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Drone className="mr-2 h-5 w-5" />
                                Quản Lý Drone
                            </CardTitle>
                            <CardDescription>
                                Theo dõi và quản lý đội drone
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full">
                                Xem Drone
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;

