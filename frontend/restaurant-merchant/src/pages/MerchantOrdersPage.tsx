import { useState, useEffect } from "react";
import MerchantLayout from "@/components/MerchantLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle, History, ChefHat, MapPin, Phone } from "lucide-react";
import { restaurantOrderService } from "@/services/restaurantOrder.service";

// Mock dữ liệu đơn hàng
interface Order {
  id: number;
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

          {status === "new" && (
            <div className="flex gap-2 pt-4 border-t">
              <Button className="flex-1 bg-primary hover:bg-primary/90">
                <ChefHat className="w-4 h-4 mr-2" />
                Xác nhận & Nấu
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent">
                Từ chối
              </Button>
            </div>
          )}

          {status === "confirmed" && (
            <div className="pt-4 border-t">
              <Button className="w-full bg-green-500 hover:bg-green-600">✓ Hoàn thành</Button>
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

  const newOrdersCount = orders.new.length;
  const confirmedOrdersCount = orders.confirmed.length;
  const historyOrdersCount = orders.history.length;

  useEffect(() => {
    const fetchOrders = async () => {
      setLoadingOrders(true);
      try {
        const resp = await restaurantOrderService.getMyOrders({ page: 1, limit: 50 });
        if (resp.success) {
          const serverOrders = resp.data as any[];
          const newList: Order[] = [];
          const confirmedList: Order[] = [];
          const historyList: Order[] = [];

          for (const ro of serverOrders) {
            // map server restaurant order to UI Order
            const uiOrder: Order = {
              id: Number(ro.orderId.slice(-6)) || Math.floor(Math.random() * 100000),
              customerName: ro.customerInfo?.userId || 'Khách hàng',
              phone: ro.customerInfo?.phone || 'N/A',
              address: ro.customerInfo?.address || ro.deliveryAddress || 'N/A',
              items: (ro.items || []).map((it: any) => ({ name: it.productName || it.name || 'Item', quantity: it.quantity || 1, price: it.price || it.productPrice || 0 })),
              total: ro.totalPrice || 0,
              status: ro.restaurantStatus?.toLowerCase() || 'confirmed',
              createdAt: ro.receivedAt || new Date().toISOString(),
              restaurantName: ''
            };

            // categorize by restaurantStatus
            if (ro.restaurantStatus === 'CONFIRMED' || ro.restaurantStatus === 'PREPARING') {
              confirmedList.push(uiOrder);
            } else if (ro.restaurantStatus === 'READY' || ro.restaurantStatus === 'COMPLETED' || ro.restaurantStatus === 'DONE') {
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
    };

    fetchOrders();
  }, []);

  return (
    <MerchantLayout>
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-balance text-foreground">Quản lý đơn hàng</h1>
            <p className="text-lg text-muted-foreground text-pretty">Xử lý và theo dõi đơn hàng của khách hàng</p>
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
                          <OrderCard key={order.id} order={order} status="new" />
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
                          <OrderCard key={order.id} order={order} status="confirmed" />
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
                          <OrderCard key={order.id} order={order} status="history" />
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
