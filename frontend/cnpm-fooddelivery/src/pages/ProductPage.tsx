import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import ProductFilter from "../components/ProductFilter";
import ProductList from "../components/ProductList";
import { useState, useEffect } from "react";
import { toast } from "sonner";
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

const ProductPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    // Lọc sản phẩm theo từ khóa tìm kiếm
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [products, searchTerm]);

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

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50">
      <Navigation />

      {/* Header Section */}
      <section className="bg-white shadow-sm">
        <div className="max-w-full mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              🍕 Thực Đơn FastFood
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Khám phá {products.length > 0 ? `${products.length}+` : "100+"} món ăn ngon được giao hàng nhanh chóng
            </p>

            {/* Search Bar */}
            <div className="max-w-md mx-auto relative">
              <input
                type="text"
                placeholder="Tìm kiếm món ăn..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-full mx-auto px-4 py-8">
        {/* Filter Section */}
        <ProductFilter />

        {/* Results Summary */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">
            Hiển thị <span className="font-semibold">{filteredProducts.length}</span> sản phẩm
            {searchTerm && (
              <span className="ml-2 text-sm">cho từ khóa "<em>{searchTerm}</em>"</span>
            )}
          </p>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-gray-600 text-sm">Xem dạng:</span>
            <button className="p-2 border border-gray-300 rounded bg-orange-500 text-white">
              ⊞
            </button>
            <button className="p-2 border border-gray-300 rounded hover:bg-gray-50">
              ☰
            </button>
          </div>
        </div>

        {/* Products List - sử dụng ProductList component */}
        <ProductList products={filteredProducts} loading={loading} />

        {/* Load More Button - chỉ hiển thị khi có sản phẩm */}
        {!loading && filteredProducts.length > 0 && (
          <div className="text-center mt-12">
            <button
              className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
              onClick={fetchProducts}
            >
              Làm mới danh sách
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ProductPage;
