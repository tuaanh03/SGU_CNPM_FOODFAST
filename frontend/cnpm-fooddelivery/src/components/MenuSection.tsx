import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Plus, Minus } from "lucide-react";
import { useCart } from "@/contexts/cart-context";

interface MenuItem {
  id: string | number;
  name: string;
  description: string;
  price: number;
  image: string;
  popular: boolean;
}

interface MenuSectionData {
  category: string;
  items: MenuItem[];
}

interface MenuSectionProps {
  section: MenuSectionData;
  restaurantId: string | number;
  restaurantName: string;
}

const MenuSection = ({ section, restaurantId, restaurantName }: MenuSectionProps) => {
  const { state, addItem, updateQuantity, formatPrice } = useCart();

  const handleAddToCart = (item: MenuItem) => {
    const cartItem = {
      id: String(item.id),
      name: item.name,
      price: item.price,
      imageUrl: item.image,
    };

    const restaurant = {
      id: String(restaurantId),
      name: restaurantName,
      imageUrl: "/burger-restaurant-interior-modern.jpg", // Default image
    };

    addItem(cartItem, restaurant);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    updateQuantity(itemId, quantity);
  };

  const getQuantityInCart = (itemId: string) => {
    // Chỉ hiển thị quantity nếu đang ở cùng restaurant
    if (state.restaurant?.id !== String(restaurantId)) {
      return 0;
    }
    const cartItem = state.items.find((item) => item.id === itemId);
    return cartItem?.quantity || 0;
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground mb-4">{section.category}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.items.map((item) => {
          const quantity = getQuantityInCart(String(item.id));

          return (
            <Card key={String(item.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="flex">
                {/* Item Info */}
                <CardContent className="flex-1 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                          {item.name}
                        </h3>
                        {item.popular && (
                          <Badge className="bg-orange-100 text-orange-800 text-xs">
                            <Star className="w-3 h-3 mr-1 fill-current" />
                            Phổ biến
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {item.description}
                      </p>

                      <p className="text-xl font-bold text-primary mb-3">
                        {formatPrice(item.price)}
                      </p>
                    </div>
                  </div>

                  {/* Add to Cart Controls */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Giao trong 15-20 phút
                    </div>

                    {quantity === 0 ? (
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(item)}
                        className="h-8 px-4"
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
                          onClick={() => handleUpdateQuantity(String(item.id), quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="font-semibold min-w-[2rem] text-center">
                          {quantity}
                        </span>
                        <Button
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleUpdateQuantity(String(item.id), quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Item Image */}
                <div className="w-24 md:w-32 h-24 md:h-32 relative flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {item.popular && (
                    <div className="absolute top-1 right-1">
                      <Badge className="bg-primary text-primary-foreground text-xs px-1 py-0">
                        HOT
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MenuSection;
