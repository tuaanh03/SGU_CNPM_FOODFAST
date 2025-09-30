import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/cart-context";

interface CartButtonProps {
  onClick: () => void;
  className?: string;
}

const CartButton = ({ onClick, className = "" }: CartButtonProps) => {
  const { state, getTotalItems, formatPrice } = useCart();

  // Không hiển thị nếu giỏ hàng rỗng
  if (state.items.length === 0) {
    return null;
  }

  const totalItems = getTotalItems();

  return (
    <div className={`fixed right-6 z-40 ${className}`}>
      <Button
        onClick={onClick}
        className="h-14 px-6 bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-full group"
        size="lg"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white">
              {totalItems}
            </Badge>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">Giỏ hàng</span>
            <span className="text-xs opacity-90">{formatPrice(state.total)}</span>
          </div>
        </div>
      </Button>
    </div>
  );
};

export default CartButton;
