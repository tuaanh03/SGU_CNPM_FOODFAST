import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ProductList = () => {
  const mockProducts = [
    {
      id: 1,
      name: "Pizza Pepperoni",
      price: 299000,
      image: "🍕",
      description: "Pizza pepperoni thơm ngon với phô mai mozzarella",
      category: "Pizza",
      rating: 4.5
    },
    {
      id: 2,
      name: "Burger Bò Phô Mai",
      price: 159000,
      image: "🍔",
      description: "Burger bò nướng với phô mai và rau tươi",
      category: "Burger",
      rating: 4.3
    },
    {
      id: 3,
      name: "Gà Rán Giòn",
      price: 189000,
      image: "🍗",
      description: "Gà rán giòn tan với gia vị đặc biệt",
      category: "Gà",
      rating: 4.7
    },
    {
      id: 4,
      name: "Mì Ý Sốt Cà",
      price: 129000,
      image: "🍝",
      description: "Mì Ý với sốt cà chua và thịt bò băm",
      category: "Mì",
      rating: 4.2
    },
    {
      id: 5,
      name: "Salad Tươi",
      price: 89000,
      image: "🥗",
      description: "Salad rau củ tươi với sốt dầu giấm",
      category: "Salad",
      rating: 4.1
    },
    {
      id: 6,
      name: "Nước Cam Tươi",
      price: 39000,
      image: "🧃",
      description: "Nước cam tươi nguyên chất 100%",
      category: "Đồ uống",
      rating: 4.4
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  return (
    <section className="w-full py-16 bg-gray-50">
      <div className="max-w-full mx-auto px-4">
        <div className="text-center mb-12">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            Thực Đơn Phổ Biến
          </h3>
          <p className="text-lg text-gray-600">
            Những món ăn được yêu thích nhất tại FastFood
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {mockProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="text-center pb-2">
                <div className="text-6xl mb-2">{product.image}</div>
                <CardTitle className="text-xl font-bold text-gray-800">
                  {product.name}
                </CardTitle>
                <div className="flex justify-center items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {product.category}
                  </Badge>
                  <span className="text-sm text-yellow-500 flex items-center">
                    ⭐ {product.rating}
                  </span>
                </div>
              </CardHeader>
              
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">{product.description}</p>
                <p className="text-2xl font-bold text-orange-500">
                  {formatPrice(product.price)}
                </p>
              </CardContent>
              
              <CardFooter className="pt-0">
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  Thêm vào giỏ
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button 
            variant="outline" 
            size="lg"
            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
          >
            Xem thêm món ăn
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ProductList;
