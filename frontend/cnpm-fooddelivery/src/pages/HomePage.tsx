import Navigation from "@/components/Navigation";
import Banner from "@/components/Banner";
import ProductList from "@/components/ProductList";
import ProductFilter from "@/components/ProductFilter";
import RestaurantList from "@/components/RestaurantList";
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

const HomePage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
      fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ProductsApiResponse>("http://localhost:3000/api/products");

      console.log("API Response:", response.data);

      // Kiểm tra response theo format của controller
      if (response.data.success && Array.isArray(response.data.data)) {
        setProducts(response.data.data);
      } else {
        console.error("Invalid API response format:", response.data);
        toast.error("Định dạng dữ liệu không hợp lệ!");
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Không thể tải danh sách sản phẩm!");
      setProducts([]);
    } finally {
      setLoading(false);
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
          <ProductList products={products} loading={loading} />
        </div>

        <RestaurantList loading={loading} />
      </div>
      <Footer />
    </div>
  );
}

export default HomePage;
