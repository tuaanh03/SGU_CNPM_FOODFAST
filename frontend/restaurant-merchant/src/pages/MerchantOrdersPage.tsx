import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useRestaurantSocket } from "@/contexts/RestaurantSocketContext";
import MerchantLayout from "@/components/MerchantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle, History, MapPin, Phone, Wifi, WifiOff, ShoppingBag, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restaurantOrderService } from "@/services/restaurantOrder.service";


interface Order {
    id: number;
    orderId?: string; // System orderId for socket events
    restaurantOrderId?: string; // ID từ RestaurantOrder table
    customerName: string;
    phone: string;
    address: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    status: string;
    createdAt: string;
    restaurantName: string;
    confirmedAt?: string;
    completedAt?: string;
    onNotifyReady?: (restaurantOrderId: string) => void;
    notifying?: boolean;
    onViewDetail?: (order: Order) => void;
    droneArrived?: boolean;
    deliveryId?: string | null;
}

const initialOrders: Record<'new' | 'confirmed' | 'history', Order[]> = { new: [], confirmed: [], history: [] };

// OrderCard component defined at the end of the file

const MerchantOrderPage = () => {
    const navigate = useNavigate();
    const { droneArrivedOrders, isConnected, socket, orderStatusUpdates } = useRestaurantSocket();
    const [activeTab, setActiveTab] = useState("new");
    const [orders, setOrders] = useState(initialOrders);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [notifyingOrderId, setNotifyingOrderId] = useState<string | null>(null);
    const [lastOrder, setLastOrder] = useState<any>(null);

    const newOrdersCount = orders.new.length;
    const confirmedOrdersCount = orders.confirmed.length;
    const historyOrdersCount = orders.history.length;

    // Handler để mở chi tiết đơn hàng
    const handleOpenOrderDetail = (order: any) => {
        navigate(`/orders/${order.restaurantOrderId}`);
    };

    // Handler để thông báo đội giao - with retry logic
    const handleNotifyReady = async (restaurantOrderId: string) => {
        if (!restaurantOrderId) return;

        setNotifyingOrderId(restaurantOrderId);

        // Retry logic để handle race condition
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📤 [MerchantOrdersPage] Notifying ready (attempt ${attempt}/${maxRetries})...`);

                const response = await restaurantOrderService.notifyReady(restaurantOrderId);

                if (response.success) {
                    console.log('✅ [MerchantOrdersPage] Notify ready successful');
                    // Reload orders to reflect status change
                    await fetchOrders();
                    alert('✅ Đã thông báo đội giao hàng thành công!');
                    setNotifyingOrderId(null);
                    return; // Success, exit
                }
            } catch (error: any) {
                console.error(`❌ [MerchantOrdersPage] Notify ready failed (attempt ${attempt}):`, error);

                // Nếu là lần thử cuối cùng hoặc không phải lỗi "not found"
                if (attempt === maxRetries || !error.message?.includes('not found')) {
                    alert(`❌ Lỗi: ${error.message || 'Không thể thông báo đội giao'}`);
                    setNotifyingOrderId(null);
                    return;
                }

                // Đợi trước khi retry
                console.log(`⏳ [MerchantOrdersPage] Waiting ${retryDelay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }

        setNotifyingOrderId(null);
    };

    // Refactor fetchOrders thành function riêng với useCallback để tránh re-create
    const fetchOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            const resp = await restaurantOrderService.getMyOrders({ page: 1, limit: 50 });
            if (resp.success) {
                const serverOrders = resp.data as any[];
                const newList: Order[] = [];
                const confirmedList: Order[] = [];
                const historyList: Order[] = [];

                for (const ro of serverOrders) {
                    // normalize server status for safe comparisons
                    const serverStatus = (ro.restaurantStatus || '').toUpperCase();

                    // map server restaurant order to UI Order
                    const uiOrder: any = {
                        id: Number(ro.orderId?.slice?.(-6)) || Math.floor(Math.random() * 100000),
                        restaurantOrderId: ro.id,
                        customerName: ro.customerInfo?.userId || 'Khách hàng',
                        phone: ro.customerInfo?.contactPhone || ro.customerInfo?.phone || 'N/A',
                        address: ro.customerInfo?.deliveryAddress || ro.customerInfo?.address || 'N/A',
                        items: (ro.items || []).map((it: any) => ({
                            name: it.productName || it.name || 'Item',
                            quantity: it.quantity || 1,
                            price: it.price || it.productPrice || 0
                        })),
                        total: ro.totalPrice || 0,
                        status: serverStatus === 'PREPARING' ? 'preparing' :
                               serverStatus === 'CONFIRMED' ? 'confirmed' :
                               serverStatus === 'READY_FOR_PICKUP' ? 'ready' :
                               (ro.restaurantStatus?.toLowerCase() || 'new'),
                        createdAt: new Date(ro.receivedAt || ro.confirmedAt).toLocaleString('vi-VN'),
                        restaurantName: '',
                        onNotifyReady: handleNotifyReady,
                        notifying: notifyingOrderId === ro.id,
                        onViewDetail: handleOpenOrderDetail,
                        droneArrived: droneArrivedOrders.has(ro.orderId || ro.id),
                        deliveryId: ro.id,
                        orderId: ro.orderId
                    };

                    // categorize by normalized serverStatus
                    // CONFIRMED, PREPARING, READY_FOR_PICKUP → Tab "Đã xác nhận"
                    if (serverStatus === 'CONFIRMED' || serverStatus === 'PREPARING' || serverStatus === 'READY_FOR_PICKUP') {
                        confirmedList.push(uiOrder);
                    } else if (serverStatus === 'COMPLETED' || serverStatus === 'DONE' || serverStatus === 'DELIVERED') {
                        historyList.push(uiOrder);
                    } else {
                        newList.push(uiOrder);
                    }
                }

                console.log('📊 [MerchantOrdersPage] Fetched orders:', {
                    new: newList.length,
                    confirmed: confirmedList.length,
                    history: historyList.length,
                    total: serverOrders.length
                });

                setOrders({ new: newList, confirmed: confirmedList, history: historyList });
            } else {
                console.warn('⚠️ [MerchantOrdersPage] Failed to load restaurant orders:', resp.message);
            }
        } catch (err) {
            console.error('❌ [MerchantOrdersPage] Error loading restaurant orders:', err);
        } finally {
            setLoadingOrders(false);
        }
    }, [droneArrivedOrders, notifyingOrderId]); // Fix: Add dependencies

    // Xử lý khi có đơn hàng mới từ socket - REAL-TIME, không cần fetch
    useEffect(() => {
        if (lastOrder) {
            console.log('🆕 New order received from socket:', lastOrder);

            // Convert socket order to UI Order format và thêm vào state
            const newOrder: Order = {
                id: Number(lastOrder.orderId?.slice?.(-6)) || Math.floor(Math.random() * 100000),
                orderId: lastOrder.orderId, // ✅ Add orderId for status update matching
                restaurantOrderId: lastOrder.orderId,
                customerName: 'Khách hàng',
                phone: lastOrder.contactPhone || 'N/A',
                address: lastOrder.deliveryAddress || 'N/A',
                items: (lastOrder.items || []).map((it: any) => ({
                    name: it.productName || it.name || 'Item',
                    quantity: it.quantity || 1,
                    price: it.price || 0
                })),
                total: lastOrder.totalPrice || 0,
                status: 'confirmed', // Mới confirmed từ payment
                createdAt: new Date(lastOrder.confirmedAt).toLocaleString('vi-VN'),
                restaurantName: '',
                onNotifyReady: handleNotifyReady,
                notifying: false,
                onViewDetail: handleOpenOrderDetail,
                droneArrived: false,
                deliveryId: null
            };

            console.log('➕ [MerchantOrdersPage] Adding new order to list:', {
                orderId: newOrder.orderId,
                status: newOrder.status,
                total: newOrder.total
            });

            // Thêm vào danh sách confirmed
            setOrders((prev) => ({
                ...prev,
                confirmed: [newOrder, ...prev.confirmed],
            }));

            console.log('✅ [MerchantOrdersPage] New order added. Total confirmed:', orders.confirmed.length + 1);

            // Chuyển sang tab "Đã xác nhận" để xem
            setActiveTab('confirmed');

            // Small delay để đảm bảo backend đã lưu vào DB
            // Sau 2 giây, refresh orders để lấy restaurantOrderId chính xác từ DB
            setTimeout(() => {
                console.log('🔄 [MerchantOrdersPage] Refreshing orders to get DB-synced data...');
                fetchOrders();
            }, 2000);
        }
    }, [lastOrder, fetchOrders]);

    // Track processed status updates để tránh xử lý lại
    const processedUpdatesRef = useRef<Set<string>>(new Set());

    // Xử lý khi có status update từ Kafka qua socket - REAL-TIME
    useEffect(() => {
        // orderStatusUpdates là Record<orderId, status>
        // Chỉ xử lý những updates CHƯA xử lý
        const newUpdates = Object.entries(orderStatusUpdates).filter(
            ([orderId]) => !processedUpdatesRef.current.has(orderId)
        );

        if (newUpdates.length === 0) {
            return; // Không có updates mới
        }

        console.log('🔍 [MerchantOrdersPage] Processing', newUpdates.length, 'new status updates');

        // Xử lý từng update mới
        newUpdates.forEach(([orderId, restaurantStatus]) => {
            console.log('📦 [MerchantOrdersPage] Processing status update:', { orderId, restaurantStatus });

            // Mark as processed
            processedUpdatesRef.current.add(orderId);

            // Map status
            const newStatus = restaurantStatus === 'PREPARING' ? 'preparing' :
                restaurantStatus === 'READY_FOR_PICKUP' ? 'ready' :
                    restaurantStatus.toLowerCase();

            // Update order trong state
            setOrders((prev) => {
                const allOrders = [...prev.new, ...prev.confirmed, ...prev.history];

                const updatedOrder = allOrders.find(o => o.orderId === orderId);

                if (!updatedOrder) {
                    console.warn(`⚠️ [MerchantOrdersPage] Order ${orderId} not found`);
                    return prev;
                }

                console.log(`✅ [MerchantOrdersPage] Updated order ${orderId}: ${updatedOrder.status} → ${newStatus}`);

                // Re-categorize orders
                const newList: Order[] = [];
                const confirmedList: Order[] = [];
                const historyList: Order[] = [];

                allOrders.forEach(order => {
                    const isUpdatedOrder = order.orderId === orderId;
                    const status = isUpdatedOrder ? newStatus : order.status;

                    // Create updated order with all necessary fields
                    const updatedOrderData: Order = {
                        ...order,
                        status,
                        // Update handlers and state
                        onNotifyReady: handleNotifyReady,
                        onViewDetail: handleOpenOrderDetail,
                        notifying: isUpdatedOrder ? notifyingOrderId === order.restaurantOrderId : order.notifying,
                        droneArrived: droneArrivedOrders.has(order.orderId || order.restaurantOrderId || ''),
                    };

                    // CONFIRMED, PREPARING, READY → Tab "Đã xác nhận"
                    if (status === 'confirmed' || status === 'preparing' || status === 'ready') {
                        confirmedList.push(updatedOrderData);
                    } else if (status === 'completed' || status === 'delivered' || status === 'done') {
                        historyList.push(updatedOrderData);
                    } else {
                        newList.push(updatedOrderData);
                    }
                });

                return { new: newList, confirmed: confirmedList, history: historyList };
            });
        });
    }, [orderStatusUpdates, notifyingOrderId, droneArrivedOrders, handleNotifyReady, handleOpenOrderDetail]);

    // Listen for new orders from socket (RestaurantSocketContext đã join room)
    useEffect(() => {
        if (!socket) {
            console.warn('⚠️ [MerchantOrdersPage] Socket not available for order:confirmed listener');
            return;
        }

        console.log('📡 [MerchantOrdersPage] Setting up order:confirmed listener');
        console.log('🔍 [MerchantOrdersPage] Socket state:', {
            id: socket.id,
            connected: socket.connected,
            disconnected: socket.disconnected,
            hasListeners: socket.listeners('order:confirmed').length
        });

        // Test: Emit a test event to verify socket is working
        if (socket.connected) {
            console.log('🧪 [MerchantOrdersPage] Socket connected, listener will work');
        } else {
            console.warn('⚠️ [MerchantOrdersPage] Socket NOT connected, waiting for connection...');
        }

        // Listen for new orders
        const handleNewOrder = (order: any) => {
            console.log('🆕 [MerchantOrdersPage] ===== NEW ORDER RECEIVED =====');
            console.log('📦 Order data:', order);
            console.log('⏰ Received at:', new Date().toISOString());
            console.log('🔢 Current confirmed orders count:', orders.confirmed.length);
            console.log('🎯 Socket ID that received event:', socket.id);
            setLastOrder(order);
        };

        socket.on('order:confirmed', handleNewOrder);
        console.log('✅ [MerchantOrdersPage] order:confirmed listener registered');
        console.log('📊 [MerchantOrdersPage] Total listeners on order:confirmed:', socket.listeners('order:confirmed').length);

        return () => {
            console.log('📡 [MerchantOrdersPage] Removing order:confirmed listener');
            socket.off('order:confirmed', handleNewOrder);
        };
    }, [socket]); // ✅ Remove orders.confirmed.length dependency

    // Chỉ fetch 1 lần khi mount - các updates sau đó đều qua socket real-time
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    return (
        <MerchantLayout>
            <div className="min-h-screen bg-background">
                <main className="container mx-auto px-4 py-8 space-y-8">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-bold text-balance text-foreground">Quản lý đơn hàng</h1>
                            <p className="text-lg text-muted-foreground text-pretty">Xử lý và theo dõi đơn hàng của khách hàng</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Debug: Test Socket Events */}
                            {import.meta.env.DEV && (
                                <>
                                    <button
                                        onClick={() => {
                                            console.log('🧪 [DEBUG] Testing socket connection:');
                                            console.log('  - Socket:', socket);
                                            console.log('  - Connected:', isConnected);
                                            console.log('  - Socket ID:', socket?.id);
                                            console.log('  - orderStatusUpdates:', orderStatusUpdates);
                                            console.log('  - droneArrivedOrders:', droneArrivedOrders);
                                            console.log('  - Current orders:', {
                                                new: orders.new.length,
                                                confirmed: orders.confirmed.length,
                                                history: orders.history.length,
                                            });

                                            if (socket && socket.connected) {
                                                console.log('✅ Socket is connected');
                                                console.log('📢 Rooms joined:', socket);
                                            } else {
                                                console.error('❌ Socket is NOT connected');
                                            }
                                        }}
                                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                    >
                                        🧪 Test Socket
                                    </button>

                                    <button
                                        onClick={() => {
                                            console.log('🔄 [DEBUG] Manually refreshing orders...');
                                            fetchOrders();
                                        }}
                                        className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                    >
                                        🔄 Refresh Orders
                                    </button>
                                </>
                            )}

                            {/* Socket connection indicator */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isConnected ? (
                                    <>
                                        <Wifi className="w-4 h-4" />
                                        <span className="text-sm font-medium">Real-time</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff className="w-4 h-4" />
                                        <span className="text-sm font-medium">Offline</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-l-4 border-l-red-500 bg-red-50/50">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground font-medium">Đơn mới</p>
                                        <p className="text-3xl font-bold text-red-600 mt-2">{newOrdersCount}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                                        <Clock className="w-6 h-6 text-red-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground font-medium">Đã xác nhận</p>
                                        <p className="text-3xl font-bold text-blue-600 mt-2">{confirmedOrdersCount}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <CheckCircle className="w-6 h-6 text-blue-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-green-500 bg-green-50/50">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground font-medium">Lịch sử</p>
                                        <p className="text-3xl font-bold text-green-600 mt-2">{historyOrdersCount}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                        <History className="w-6 h-6 text-green-600" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Danh sách đơn hàng</CardTitle>
                            <CardDescription>Quản lý và theo dõi trạng thái các đơn hàng</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="new" className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <span className="hidden sm:inline">Đơn mới</span>
                                        <Badge variant="destructive" className="ml-2">
                                            {newOrdersCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="confirmed" className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        <span className="hidden sm:inline">Đã xác nhận</span>
                                        <Badge className="bg-blue-500 ml-2">{confirmedOrdersCount}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="history" className="flex items-center gap-2">
                                        <History className="w-4 h-4" />
                                        <span className="hidden sm:inline">Lịch sử</span>
                                        <Badge variant="outline" className="ml-2">
                                            {historyOrdersCount}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <div className="mt-6">
                                    <TabsContent value="new" className="space-y-4">
                                        {loadingOrders ? (
                                            <div className="text-center py-12">Đang tải...</div>
                                        ) : orders.new.length > 0 ? (
                                            <div className="grid gap-4">
                                                {orders.new.map((order) => (
                                                    <OrderCard
                                                        key={order.id}
                                                        order={order}
                                                        status={order.status}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                                <p className="text-muted-foreground">Không có đơn hàng mới</p>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="confirmed" className="space-y-4">
                                        {loadingOrders ? (
                                            <div className="text-center py-12">Đang tải...</div>
                                        ) : orders.confirmed.length > 0 ? (
                                            <div className="grid gap-4">
                                                {orders.confirmed.map((order) => (
                                                    <OrderCard
                                                        key={order.id}
                                                        order={order}
                                                        status={order.status}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                                <p className="text-muted-foreground">Không có đơn hàng nào được xác nhận</p>
                                            </div>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="history" className="space-y-4">
                                        {loadingOrders ? (
                                            <div className="text-center py-12">Đang tải...</div>
                                        ) : orders.history.length > 0 ? (
                                            <div className="grid gap-4">
                                                {orders.history.map((order) => (
                                                    <OrderCard
                                                        key={order.id}
                                                        order={order}
                                                        status={order.status}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                                <p className="text-muted-foreground">Không có lịch sử đơn hàng</p>
                                            </div>
                                        )}
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </MerchantLayout>
    );
};

// OrderCard Component
const OrderCard = ({ order, status }: { order: Order; status: string }) => {
    const getStatusBadge = () => {
        const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
            'confirmed': { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700', icon: '✅' },
            'preparing': { label: 'Đang chuẩn bị', color: 'bg-orange-100 text-orange-700', icon: '👨‍🍳' },
            'ready': { label: 'Sẵn sàng', color: 'bg-green-100 text-green-700', icon: '📦' },
            'completed': { label: 'Hoàn thành', color: 'bg-gray-100 text-gray-700', icon: '✔️' },
        };

        const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: '📋' };

        return (
            <Badge className={config.color}>
                <span className="mr-1">{config.icon}</span>
                {config.label}
            </Badge>
        );
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">Đơn hàng #{order.id}</CardTitle>
                                {getStatusBadge()}
                                {order.droneArrived && (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                                        🚁 Drone đã đến!
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {order.items.length} món • {order.createdAt}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Địa chỉ:</span>
                        <span className="font-medium">{order.address}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Liên hệ:</span>
                        <span className="font-medium">{order.phone}</span>
                    </div>

                    <div className="pt-3 border-t">
                        <div className="text-sm space-y-1">
                            {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {item.quantity}x {item.name}
                                    </span>
                                    <span className="font-medium">{item.price.toLocaleString()}đ</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center pt-3 mt-3 border-t">
                            <span className="font-semibold">Tổng cộng:</span>
                            <span className="text-xl font-bold text-primary">
                                {order.total.toLocaleString()}đ
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => order.onViewDetail?.(order)}
                            className="flex-1"
                        >
                            <Eye className="w-4 h-4 mr-2" />
                            Chi tiết
                        </Button>

                        {/* Nút Thông báo drone - Chỉ hiện khi status = preparing */}
                        {status === 'preparing' && order.restaurantOrderId && (
                            <Button
                                size="sm"
                                onClick={() => order.onNotifyReady?.(order.restaurantOrderId!)}
                                disabled={order.notifying}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                {order.notifying ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Đang xử lý...
                                    </>
                                ) : (
                                    <>
                                        🚚 Thông báo đội giao (Ready)
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Badge khi đã sẵn sàng */}
                        {status === 'ready' && (
                            <div className="flex-1 flex items-center justify-center text-sm text-green-700 font-medium bg-green-50 px-3 py-2 rounded-md">
                                ✅ Đã sẵn sàng - Đội drone đã được thông báo
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default MerchantOrderPage;