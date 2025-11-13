import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Drone, Clock, CheckCircle, LogOut } from "lucide-react";
import { mockOrders, mockDrones } from "@/services/mockData";

const DashboardPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const stats = {
        pendingOrders: mockOrders.filter(o => o.status === 'PENDING_APPROVAL').length,
        inTransit: mockOrders.filter(o => o.status === 'IN_TRANSIT').length,
        delivered: mockOrders.filter(o => o.status === 'DELIVERED').length,
        availableDrones: mockDrones.filter(d => d.status === 'AVAILABLE').length,
    };

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
                <div className="grid gap-4 md:grid-cols-2">
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

                    <Card className="cursor-pointer transition-all hover:shadow-lg opacity-60">
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
                            <Button className="w-full" variant="outline" disabled>
                                Đang Phát Triển
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;

