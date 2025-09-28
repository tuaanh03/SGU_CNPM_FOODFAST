import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import RestaurantHeader from "@/components/RestaurantHeader";
import MenuSection from "@/components/MenuSection";
import CartButton from "@/components/CartButton";
import CartDrawer from "@/components/CartDrawer";

// Mock data cho nhà hàng (giống food-delivery-app)
const restaurantData = {
  id: 1,
  name: "Burger King Việt Nam",
  image: "/burger-restaurant-interior-modern.jpg",
  rating: 4.5,
  reviewCount: 1250,
  deliveryTime: "20-30 phút",
  deliveryFee: "15.000đ",
  categories: ["Đồ ăn nhanh", "Burger", "Gà rán"],
  promo: "Giảm 30% đơn từ 99k",
  distance: "1.2km",
  address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
  openTime: "08:00 - 22:00",
};

const menuData = [
  {
    category: "Burger Bò",
    items: [
      {
        id: 1,
        name: "Whopper Burger",
        description: "Burger bò nướng flame-grilled với rau xanh tươi, cà chua, hành tây và sốt đặc biệt",
        price: 89000,
        image: "/whopper-burger-with-beef-patty.jpg",
        popular: true,
      },
      {
        id: 2,
        name: "Big King Burger",
        description: "Burger bò đôi với phô mai, rau xanh và sốt Big King đặc trưng",
        price: 95000,
        image: "/big-king-burger-double-beef.jpg",
        popular: false,
      },
      {
        id: 3,
        name: "Bacon King Burger",
        description: "Burger bò với bacon giòn, phô mai cheddar và sốt mayonnaise",
        price: 105000,
        image: "/bacon-king-burger-with-crispy-bacon.jpg",
        popular: true,
      },
    ],
  },
  {
    category: "Gà Rán & Burger Gà",
    items: [
      {
        id: 4,
        name: "Chicken Royale",
        description: "Burger gà giòn với rau xanh tươi và sốt mayonnaise đặc biệt",
        price: 75000,
        image: "/chicken-royale-burger-crispy.jpg",
        popular: false,
      },
      {
        id: 5,
        name: "Gà Rán Giòn (6 miếng)",
        description: "Gà rán giòn tan với gia vị đặc trưng, ăn kèm khoai tây chiên",
        price: 120000,
        image: "/crispy-fried-chicken.png",
        popular: true,
      },
    ],
  },
  {
    category: "Đồ Uống",
    items: [
      {
        id: 6,
        name: "Coca Cola (Ly lớn)",
        description: "Nước ngọt Coca Cola tươi mát",
        price: 25000,
        image: "/coca-cola-large-cup-with-ice.jpg",
        popular: false,
      },
      {
        id: 7,
        name: "Trà Đào Cam Sả",
        description: "Trà đào cam sả thơm mát, giải khát tuyệt vời",
        price: 35000,
        image: "/peach-tea-with-lemongrass.jpg",
        popular: true,
      },
    ],
  },
];

const RestaurantDetailPage = () => {
  // const { id } = useParams(); // Tạm thời comment vì chưa sử dụng
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleCartToggle = () => {
    setIsCartOpen(true);
  };

  const handleCartClose = () => {
    setIsCartOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="relative">
        <RestaurantHeader restaurant={restaurantData} />
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {menuData.map((section) => (
              <MenuSection
                key={section.category}
                section={section}
                restaurantId={restaurantData.id}
                restaurantName={restaurantData.name}
              />
            ))}
          </div>
        </div>

        {/* Cart Button - chỉ hiện khi có món trong giỏ */}
        <CartButton
          onClick={handleCartToggle}
          className="bottom-24"
        />

        {/* Cart Drawer */}
        <CartDrawer
          isOpen={isCartOpen}
          onClose={handleCartClose}
        />
      </main>
      <Footer />
    </div>
  );
};

export default RestaurantDetailPage;
