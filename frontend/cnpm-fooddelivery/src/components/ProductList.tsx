import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Interface theo schema Product từ backend
interface Product {
  id: string;
  sku: string;
  name: string;
  price: number; // giá tính bằng VND (Int)
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  stockOnHand: number;
  category?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProductListProps {
  products?: Product[];
  loading?: boolean;
}

const ProductList = ({ products = [], loading = false }: ProductListProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  // Fallback image nếu không có imageUrl
  const getProductImage = (imageUrl?: string) => {
    if (imageUrl) return imageUrl;
    return "🍽️"; // emoji mặc định cho món ăn
  };

  if (loading) {
    return (
      <section className="w-full py-16 bg-gray-50">
        <div className="max-w-full mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Thực Đơn Phổ Biến
            </h3>
            <p className="text-lg text-gray-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-16 bg-gray-50">
      <div className="max-w-full mx-auto px-4">
        <div className="text-center mb-12">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Thực Đơn Phổ Biến
          </h3>
          <p className="text-lg text-gray-600">
            {products.length > 0 ? `${products.length} món ăn có sẵn` : "Chưa có sản phẩm nào"}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Không có sản phẩm nào để hiển thị</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {products.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="text-center pb-2">
                  <div className="text-6xl mb-2">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded-lg mx-auto"
                      />
                    ) : (
                      getProductImage()
                    )}
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-800">
                    {product.name}
                  </CardTitle>
                  <div className="flex justify-center items-center gap-2">
                    {product.category && (
                      <Badge variant="secondary" className="text-xs">
                        {product.category.name}
                      </Badge>
                    )}
                    <Badge
                      variant={product.isAvailable ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {product.isAvailable ? `Còn ${product.stockOnHand}` : "Hết hàng"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                </CardHeader>

                <CardContent className="text-center">
                  <p className="text-gray-600 mb-4">
                    {product.description || "Món ăn ngon tại FastFood"}
                  </p>
                  <p className="text-2xl font-bold text-orange-500">
                    {formatPrice(product.price)}
                  </p>
                </CardContent>

                <CardFooter className="pt-0">
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={!product.isAvailable || product.stockOnHand === 0}
                  >
                    {product.isAvailable && product.stockOnHand > 0 ? "Thêm vào giỏ" : "Hết hàng"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {products.length > 0 && (
          <div className="text-center mt-12">
            <Button
              variant="outline"
              size="lg"
              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
            >
              Xem thêm món ăn
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductList;
