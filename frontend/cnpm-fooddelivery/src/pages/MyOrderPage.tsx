import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OngoingOrders from "@/components/OngoingOrders";
import OrderHistory from "@/components/OrderHistory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MyOrderPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Đơn hàng của tôi</h1>
            <p className="text-muted-foreground">Theo dõi đơn hàng hiện tại và xem lịch sử đặt hàng</p>
          </div>

          <Tabs defaultValue="ongoing" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ongoing">Đơn hàng hiện tại</TabsTrigger>
              <TabsTrigger value="history">Lịch sử đặt hàng</TabsTrigger>
            </TabsList>

            <TabsContent value="ongoing">
              <Card>
                <CardHeader>
                  <CardTitle>Đơn hàng đang xử lý</CardTitle>
                  <CardDescription>
                    Theo dõi tình trạng đơn hàng và liên hệ với nhà hàng hoặc shipper
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OngoingOrders />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Lịch sử đặt hàng</CardTitle>
                  <CardDescription>
                    Xem lại các đơn hàng đã hoàn thành, đặt lại món ăn yêu thích hoặc đánh giá nhà hàng
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OrderHistory />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default MyOrderPage;
