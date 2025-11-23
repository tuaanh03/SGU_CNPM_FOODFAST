import { useState, useEffect, useCallback } from "react";
import MerchantLayout from "@/components/MerchantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle, History, MapPin, Phone, Wifi, WifiOff } from "lucide-react";
import { restaurantOrderService } from "@/services/restaurantOrder.service";
import { useRestaurantOrders } from "@/lib/useRestaurantOrders";

// Mock dữ liệu đơn hàng
interface Order {
  id: number;
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
}

const initialOrders: Record<'new' | 'confirmed' | 'history', Order[]> = { new: [], confirmed: [], history: [] };

function OrderCard({ order, status }: any) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Đơn #{order.id}</h3>
                {status === "new" && <Badge className="bg-red-500">Mới</Badge>}
                {status === "confirmed" && <Badge className="bg-blue-500">Đã xác nhận</Badge>}
                {status === "preparing" && <Badge className="bg-yellow-500">Đang chuẩn bị</Badge>}
                {status === "ready" && <Badge className="bg-green-500">Sẵn sàng</Badge>}
                {status === "history" && <Badge variant="outline">Hoàn thành</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{order.restaurantName}</p>
            </div>
            <p className="text-lg font-bold text-primary">{order.total.toLocaleString("vi-VN")}đ</p>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="font-medium text-foreground">{order.customerName}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4" />
              {order.phone}
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{order.address}</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="font-semibold text-sm">Các món ăn:</p>
            <div className="space-y-1">
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">{item.price.toLocaleString("vi-VN")}đ</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-4 h-4" />
            {order.createdAt}
          </div>

          {/* Kafka tự động update sau 30s - không cần buttons thủ công */}
          {status === "confirmed" && (
            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground text-center py-2 bg-blue-50 rounded">
                ⏱️ Đơn hàng sẽ tự động chuyển sang "Đang chuẩn bị" sau 30 giây
              </div>
            </div>
          )}

          {status === "preparing" && (
            <div className="pt-4 border-t space-y-2">
              <div className="text-sm text-muted-foreground text-center py-2 bg-yellow-50 rounded">
                👨‍🍳 Đang chuẩn bị món ăn...
              </div>
              {order.onNotifyReady && (
                <button
                  onClick={() => order.onNotifyReady(order.restaurantOrderId)}
                  disabled={order.notifying}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {order.notifying ? '⏳ Đang thông báo...' : '🚚 Thông báo đội giao (Ready)'}
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const MerchantOrderPage = () => {
  const [activeTab, setActiveTab] = useState("new");
  const [orders, setOrders] = useState(initialOrders);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [notifyingOrderId, setNotifyingOrderId] = useState<string | null>(null);

  // Socket.IO real-time orders
  const { lastOrder, statusUpdate, isConnected } = useRestaurantOrders(storeId);

  const newOrdersCount = orders.new.length;
  const confirmedOrdersCount = orders.confirmed.length;
  const historyOrdersCount = orders.history.length;

  // Handler để thông báo đội giao
  const handleNotifyReady = async (restaurantOrderId: string) => {
    if (!restaurantOrderId) return;

    setNotifyingOrderId(restaurantOrderId);
    try {
      const response = await restaurantOrderService.notifyReady(restaurantOrderId);
      if (response.success) {
        // Reload orders to reflect status change
        await fetchOrders();
        alert('✅ Đã thông báo đội giao hàng thành công!');
      }
    } catch (error: any) {
      console.error('Error notifying ready:', error);
      alert('❌ Lỗi: ' + error.message);
    } finally {
      setNotifyingOrderId(null);
    }
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
            status: serverStatus === 'PREPARING' ? 'preparing' : (serverStatus === 'CONFIRMED' ? 'confirmed' : (ro.restaurantStatus?.toLowerCase() || 'new')),
            createdAt: new Date(ro.receivedAt || ro.confirmedAt).toLocaleString('vi-VN'),
            restaurantName: '',
            onNotifyReady: handleNotifyReady,
            notifying: notifyingOrderId === ro.id
          };

          // categorize by normalized serverStatus
          if (serverStatus === 'CONFIRMED' || serverStatus === 'PREPARING') {
            confirmedList.push(uiOrder);
          } else if (serverStatus === 'READY' || serverStatus === 'COMPLETED' || serverStatus === 'DONE') {
            historyList.push(uiOrder);
          } else {
            newList.push(uiOrder);
          }
        }

        setOrders({ new: newList, confirmed: confirmedList, history: historyList });
      } else {
        console.warn('Failed to load restaurant orders:', resp.message);
      }
    } catch (err) {
      console.error('Error loading restaurant orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []); // Empty deps - function stable, chỉ phụ thuộc vào service call

  // Load storeId từ API
  useEffect(() => {
    const loadStoreId = async () => {
      try {
        // Import store service để lấy thông tin store
        const { storeService } = await import('@/services/store.service');
        const response = await storeService.getMyStore();

        if (response.success && response.data) {
          const storeInfo = response.data;
          setStoreId(storeInfo.id);
          console.log('✅ Loaded storeId for socket:', storeInfo.id);

          // Save to localStorage for future use
          localStorage.setItem('storeInfo', JSON.stringify(storeInfo));
        } else {
          console.warn('⚠️ No store found for merchant');
        }
      } catch (error) {
        console.error('❌ Error loading storeId:', error);
      }
    };
    loadStoreId();
  }, []);

  // Xử lý khi có đơn hàng mới từ socket - REAL-TIME, không cần fetch
  useEffect(() => {
    if (lastOrder) {
      console.log('🆕 New order received from socket:', lastOrder);

      // Convert socket order to UI Order format và thêm vào state
      const newOrder: Order = {
        id: Number(lastOrder.orderId?.slice?.(-6)) || Math.floor(Math.random() * 100000),
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
        restaurantName: ''
      };

      // Thêm vào danh sách confirmed
      setOrders((prev) => ({
        ...prev,
        confirmed: [newOrder, ...prev.confirmed],
      }));

      // Chuyển sang tab "Đã xác nhận" để xem
      setActiveTab('confirmed');
    }
  }, [lastOrder]);

  // Xử lý khi có status update từ Kafka qua socket - REAL-TIME
  useEffect(() => {
    if (statusUpdate) {
      console.log('📦 Status update from socket:', statusUpdate);

      const { orderId, restaurantStatus } = statusUpdate;

      // Map status
      const newStatus = restaurantStatus === 'PREPARING' ? 'preparing' :
                       restaurantStatus === 'READY' ? 'ready' :
                       restaurantStatus.toLowerCase();

      // Update order trong state
      setOrders((prev) => {
        const allOrders = [...prev.new, ...prev.confirmed, ...prev.history];
        const updatedOrder = allOrders.find(o => o.restaurantOrderId === orderId);

        if (!updatedOrder) return prev;

        // Update status
        updatedOrder.status = newStatus;

        // Re-categorize orders
        const newList: Order[] = [];
        const confirmedList: Order[] = [];
        const historyList: Order[] = [];

        allOrders.forEach(order => {
          const status = order.restaurantOrderId === orderId ? newStatus : order.status;

          if (status === 'confirmed' || status === 'preparing') {
            confirmedList.push({ ...order, status });
          } else if (status === 'ready' || status === 'completed') {
            historyList.push({ ...order, status });
          } else {
            newList.push({ ...order, status });
          }
        });

        return { new: newList, confirmed: confirmedList, history: historyList };
      });
    }
  }, [statusUpdate]);

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

export default MerchantOrderPage;
