import Navigation from "@/components/Navigation";
import Banner from "@/components/Banner";
import ProductList from "@/components/ProductList";
import ProductFilter from "@/components/ProductFilter";
import RestaurantList, { type RestaurantItem } from "@/components/RestaurantList";
import Footer from "@/components/Footer";
import {useState, useEffect} from "react";
import {toast} from "sonner";
import axios from "axios";
import API_BASE_URL from "@/config/api";
import { useAddress } from "@/contexts/address-context";
import { locationService } from "@/services/location.service";
import { restaurantService } from "@/services/restaurant.service";
import type { Restaurant } from "@/services/restaurant.service";

// Interface theo schema Product từ backend
interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
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

// Interface cho API response
interface ProductsApiResponse {
  success: boolean;
  data: Product[];
  message?: string;
}

const HomePage = () => {
  const { selectedAddress } = useAddress();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
      fetchProducts();
  }, []);

  // Load nearby restaurants khi địa chỉ thay đổi
  useEffect(() => {
    if (selectedAddress) {
      fetchNearbyRestaurants();
    }
  }, [selectedAddress]);

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const response = await axios.get<ProductsApiResponse>(`${API_BASE_URL}/products`);

      // Kiểm tra response theo format của controller
      if (response.data.success && Array.isArray(response.data.data)) {
        setProducts(response.data.data);
      } else {
        toast.error("Định dạng dữ liệu sản phẩm không hợp lệ!");
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Không thể tải danh sách sản phẩm!");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  const fetchNearbyRestaurants = async () => {
    if (!selectedAddress) {
      setRestaurants([]);
      return;
    }

    try {
      setRestaurantsLoading(true);

      let lat = selectedAddress.latitude;
      let lng = selectedAddress.longitude;

      // Geocode nếu địa chỉ chưa có tọa độ
      if (!lat || !lng) {
        console.log("📍 Geocoding address...");
        const geocodeResult = await locationService.geocode({
          address: selectedAddress.address,
          ward: selectedAddress.ward,
          district: selectedAddress.district,
          province: selectedAddress.province,
        });
        lat = geocodeResult.latitude;
        lng = geocodeResult.longitude;
      }

      // Lấy nhà hàng gần trong bán kính 10km
      console.log(`🔍 Finding restaurants near ${lat}, ${lng}...`);
      const { data } = await restaurantService.getNearbyRestaurants({
        lat,
        lng,
        radius: 10,
      });

      // Convert Restaurant → RestaurantItem
      const mapped: RestaurantItem[] = data.map((restaurant: Restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        image: restaurant.cover || restaurant.avatar || "/burger-restaurant-storefront.png",
        rating: restaurant.rating || 4.5,
        deliveryTime: "20-30 phút",
        deliveryFee: restaurant.distance && restaurant.distance < 3 ? "Miễn phí" : "15.000đ",
        categories: [],
        promo: "Ưu đãi hấp dẫn",
        distance: `${restaurant.distance?.toFixed(1)} km`,
      }));

      setRestaurants(mapped);

      if (mapped.length === 0) {
        toast.info("Không có nhà hàng nào trong bán kính 10km từ địa chỉ của bạn");
      }
    } catch (error: any) {
      console.error("Error loading nearby restaurants:", error);
      toast.error(error.message || "Không thể tải danh sách nhà hàng");
      setRestaurants([]);
    } finally {
      setRestaurantsLoading(false);
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Banner />
      <div className="container mx-auto px-4 py-6 space-y-12">
        <div className="space-y-6">
          <ProductFilter
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
          />
          <ProductList products={products} loading={productsLoading} />
        </div>

        <RestaurantList restaurants={restaurants} loading={restaurantsLoading} />
      </div>
      <Footer />
    </div>
  );
}

export default HomePage;
