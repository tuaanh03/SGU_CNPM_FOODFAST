import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const ProductGrid = () => {
  const products = [
    {
      id: 1,
      name: "Pizza Pepperoni Đặc Biệt",
      price: 299000,
      originalPrice: 349000,
      image: "🍕",
      description: "Pizza pepperoni thơm ngon với phô mai mozzarella cao cấp",
      category: "Pizza",
      rating: 4.8,
      reviews: 156,
      discount: 15,
      isHot: true
    },
    {
      id: 2,
      name: "Pizza Hải Sản Deluxe",
      price: 389000,
      originalPrice: null,
      image: "🍕",
      description: "Pizza hải sản tươi ngon với tôm, mực và phô mai",
      category: "Pizza",
      rating: 4.6,
      reviews: 89,
      discount: 0,
      isHot: false
    },
    {
      id: 3,
      name: "Burger Bò Úc Phô Mai",
      price: 179000,
      originalPrice: 199000,
      image: "🍔",
      description: "Burger bò Úc nướng với phô mai cheddar và rau tươi",
      category: "Burger",
      rating: 4.5,
      reviews: 203,
      discount: 10,
      isHot: false
    },
    {
      id: 4,
      name: "Burger Gà Giòn Cay",
      price: 159000,
      originalPrice: null,
      image: "🍔",
      description: "Burger gà giòn cay với sốt đặc biệt",
      category: "Burger",
      rating: 4.3,
      reviews: 124,
      discount: 0,
      isHot: true
    },
    {
      id: 5,
      name: "Gà Rán Giòn 8 Miếng",
      price: 219000,
      originalPrice: 259000,
      image: "🍗",
      description: "8 miếng gà rán giòn tan với gia vị bí mật",
      category: "Gà",
      rating: 4.7,
      reviews: 312,
      discount: 15,
      isHot: false
    },
    {
      id: 6,
      name: "Gà Nướng Honey BBQ",
      price: 189000,
      originalPrice: null,
      image: "🍗",
      description: "Gà nướng với sốt honey BBQ đặc trưng",
      category: "Gà",
      rating: 4.4,
      reviews: 98,
      discount: 0,
      isHot: false
    },
    {
      id: 7,
      name: "Mì Ý Carbonara",
      price: 149000,
      originalPrice: null,
      image: "🍝",
      description: "Mì Ý carbonara với bacon và phô mai parmesan",
      category: "Mì",
      rating: 4.2,
      reviews: 67,
      discount: 0,
      isHot: false
    },
    {
      id: 8,
      name: "Mì Ý Sốt Cà Chua Thịt Bò",
      price: 139000,
      originalPrice: 159000,
      image: "🍝",
      description: "Mì Ý với sốt cà chua và thịt bò băm tươi",
      category: "Mì",
      rating: 4.1,
      reviews: 45,
      discount: 12,
      isHot: false
    },
    {
      id: 9,
      name: "Combo Gia Đình",
      price: 599000,
      originalPrice: 699000,
      image: "🍕",
      description: "1 Pizza lớn + 4 miếng gà + 2 nước ngọt",
      category: "Combo",
      rating: 4.9,
      reviews: 234,
      discount: 14,
      isHot: true
    },
    {
      id: 10,
      name: "Coca Cola",
      price: 25000,
      originalPrice: null,
      image: "🥤",
      description: "Nước ngọt Coca Cola 330ml",
      category: "Đồ uống",
      rating: 4.0,
      reviews: 89,
      discount: 0,
      isHot: false
    },
    {
      id: 11,
      name: "Nước Cam Tươi",
      price: 45000,
      originalPrice: null,
      image: "🧃",
      description: "Nước cam tươi nguyên chất 100%",
      category: "Đồ uống",
      rating: 4.3,
      reviews: 56,
      discount: 0,
      isHot: false
    },
    {
      id: 12,
      name: "Pizza Chay Đặc Biệt",
      price: 259000,
      originalPrice: null,
      image: "🍕",
      description: "Pizza chay với rau củ tươi và phô mai thực vật",
      category: "Pizza",
      rating: 4.0,
      reviews: 34,
      discount: 0,
      isHot: false
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <Card key={product.id} className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
          {product.isHot && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
              🔥 HOT
            </div>
          )}

          {product.discount > 0 && (
            <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
              -{product.discount}%
            </div>
          )}

          <CardHeader className="text-center pb-2">
            <div className="text-6xl mb-2">{product.image}</div>
            <CardTitle className="text-lg font-bold text-gray-800 line-clamp-2">
              {product.name}
            </CardTitle>
            <div className="flex justify-center items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {product.category}
              </Badge>
              <div className="flex items-center gap-1">
                <span className="text-sm text-yellow-500">⭐</span>
                <span className="text-sm font-medium">{product.rating}</span>
                <span className="text-xs text-gray-500">({product.reviews})</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="text-center pb-2">
            <p className="text-gray-600 mb-4 text-sm line-clamp-2">{product.description}</p>
            <div className="flex justify-center items-center gap-2">
              <p className="text-xl font-bold text-orange-500">
                {formatPrice(product.price)}
              </p>
              {product.originalPrice && (
                <p className="text-sm text-gray-400 line-through">
                  {formatPrice(product.originalPrice)}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="pt-0 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              Xem chi tiết
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              Thêm vào giỏ
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ProductGrid;
