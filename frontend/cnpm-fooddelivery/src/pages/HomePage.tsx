import Navigation from "@/components/Navigation";
import Banner from "@/components/Banner";
import ProductList from "@/components/ProductList";
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

    return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <Navigation />
      <Banner />
      <ProductList products={products} loading={loading} />
      <Footer />
    </div>
  );
}

export default HomePage;
