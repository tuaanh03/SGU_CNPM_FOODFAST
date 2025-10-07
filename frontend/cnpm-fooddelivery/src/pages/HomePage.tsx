import Navigation from "@/components/Navigation";
import Banner from "@/components/Banner";
import ProductList from "@/components/ProductList";
import ProductFilter from "@/components/ProductFilter";
import RestaurantList, { type RestaurantItem } from "@/components/RestaurantList";
import Footer from "@/components/Footer";
import {useState, useEffect} from "react";
import {toast} from "sonner";
import axios from "axios";

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

// Store API response (from user-service via gateway)
interface Store {
  id: string;
  name: string;
  description?: string;
  avatar?: string | null;
  cover?: string | null;
  address?: string | null;
  ward?: string | null;
  district?: string | null;
  province?: string | null;
  phone?: string | null;
  email?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface StoresApiResponse {
  success: boolean;
  data: {
    stores: Store[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }
  }
}

const API_BASE = "http://localhost:3000"; // via API Gateway

const HomePage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
      fetchProducts();
      fetchStores();
  }, []);

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const response = await axios.get<ProductsApiResponse>(`${API_BASE}/api/products`);

      // Kiểm tra response theo format của controller
      if (response.data.success && Array.isArray(response.data.data)) {
        setProducts(response.data.data);
      } else {
        toast.error("Định dạng dữ liệu sản phẩm không hợp lệ!");
        setProducts([]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching products:", error);
      toast.error("Không thể tải danh sách sản phẩm!");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  const fetchStores = async () => {
    try {
      setRestaurantsLoading(true);
      const response = await axios.get<StoresApiResponse>(`${API_BASE}/api/stores`);

      if (response.data.success && Array.isArray(response.data.data?.stores)) {
        const mapped: RestaurantItem[] = response.data.data.stores.map((store) => ({
          id: store.id,
          name: store.name,
          image: store.cover || store.avatar || "/burger-restaurant-storefront.png",
          rating: 4.5, // tạm thời mock, backend chưa có rating
          deliveryTime: "20-30 phút",
          deliveryFee: "Miễn phí",
          categories: [],
          promo: "Ưu đãi hấp dẫn",
          distance: "1.2km",
        }));
        setRestaurants(mapped);
      } else {
        toast.error("Định dạng dữ liệu cửa hàng không hợp lệ!");
        setRestaurants([]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching stores:", error);
      toast.error("Không thể tải danh sách nhà hàng!");
      setRestaurants([]);
    } finally {
      setRestaurantsLoading(false);
    }
  }

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
