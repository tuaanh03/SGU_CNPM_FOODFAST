import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import ProductFilter from "../components/ProductFilter";
import ProductGrid from "../components/ProductGrid";

const ProductPage = () => {
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
              Khám phá hơn 100+ món ăn ngon được giao hàng nhanh chóng
            </p>

            {/* Search Bar */}
            <div className="max-w-md mx-auto relative">
              <input
                type="text"
                placeholder="Tìm kiếm món ăn..."
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
            Hiển thị <span className="font-semibold">12</span> sản phẩm
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

        {/* Products Grid */}
        <ProductGrid />

        {/* Load More Button */}
        <div className="text-center mt-12">
          <button className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold">
            Xem thêm sản phẩm
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductPage;
