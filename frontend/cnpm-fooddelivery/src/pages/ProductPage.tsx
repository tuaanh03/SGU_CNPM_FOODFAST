import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ProductFilter from "@/components/ProductFilter";
import ProductList from "@/components/ProductList";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";

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

const ProductPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    // Lọc sản phẩm theo từ khóa tìm kiếm và category
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Lọc theo category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(product => {
        const categoryName = product.category?.name.toLowerCase();
        return categoryName?.includes(selectedCategory.toLowerCase());
      });
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get<ProductsApiResponse>("http://localhost:3000/api/products");

      console.log("API Response:", response.data);

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
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-balance text-foreground">
            Thực Đơn FastFood
          </h1>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            Khám phá {products.length > 0 ? `${products.length}+` : "100+"} món ăn ngon được giao hàng nhanh chóng
          </p>
        </div>

        <div className="flex gap-3 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Tìm kiếm món ăn, nhà hàng..."
              className="pl-10 h-12 text-base"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <Button variant="outline" size="lg" className="px-4 bg-transparent">
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>

        <ProductFilter
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />

        {searchTerm && (
          <div className="text-center">
            <p className="text-muted-foreground">
              Hiển thị <span className="font-semibold text-foreground">{filteredProducts.length}</span> kết quả
              cho "<span className="font-medium text-primary">{searchTerm}</span>"
            </p>
          </div>
        )}

        <ProductList products={filteredProducts} loading={loading} />

        {!loading && filteredProducts.length === 0 && searchTerm && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Không tìm thấy kết quả</h3>
            <p className="text-muted-foreground mb-4">
              Không có món ăn nào phù hợp với từ khóa "{searchTerm}"
            </p>
            <Button onClick={() => setSearchTerm("")} variant="outline">
              Xóa bộ lọc
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ProductPage;
