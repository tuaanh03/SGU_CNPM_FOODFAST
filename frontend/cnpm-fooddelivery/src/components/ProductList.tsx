import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Truck, MapPin, Plus, Minus } from "lucide-react";
import { useCart } from "@/contexts/cart-context";

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
  const { state, dispatch } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const handleAddToCart = (product: Product) => {
    dispatch({
      type: "ADD_ITEM",
      payload: {
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
      },
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    dispatch({
      type: "UPDATE_QUANTITY",
      payload: { id: productId, quantity },
    });
  };

  const getQuantityInCart = (productId: string) => {
    const cartItem = state.items.find((item) => item.id === productId);
    return cartItem?.quantity || 0;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Thực đơn phổ biến</h2>
        <p className="text-muted-foreground">{products.length} món ăn</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const quantity = getQuantityInCart(product.id);

          return (
            <Card key={product.id} className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="relative">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-48 bg-muted flex items-center justify-center text-6xl group-hover:scale-105 transition-transform duration-300">
                    🍽️
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                  {product.category?.name || "Món ăn"}
                </Badge>
                <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-md text-sm flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  4.5
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.category && (
                      <Badge variant="secondary" className="text-xs">
                        {product.category.name}
                      </Badge>
                    )}
                    <Badge
                      variant={product.isAvailable ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {product.isAvailable ? `Còn ${product.stockOnHand}` : "Hết hàng"}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    15-20 phút
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    Miễn phí
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    1.2km
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-primary">
                    {formatPrice(product.price)}
                  </p>

                  {quantity === 0 ? (
                    <Button
                      className="h-8 px-3"
                      size="sm"
                      disabled={!product.isAvailable || product.stockOnHand === 0}
                      onClick={() => handleAddToCart(product)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Thêm
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleUpdateQuantity(product.id, quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-semibold min-w-[2rem] text-center">
                        {quantity}
                      </span>
                      <Button
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleUpdateQuantity(product.id, quantity + 1)}
                        disabled={!product.isAvailable || product.stockOnHand <= quantity}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProductList;
