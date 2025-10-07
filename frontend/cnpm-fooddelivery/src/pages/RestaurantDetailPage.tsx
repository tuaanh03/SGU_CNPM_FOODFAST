import { useEffect, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import RestaurantHeader from "@/components/RestaurantHeader";
import MenuSection from "@/components/MenuSection";
import CartButton from "@/components/CartButton";
import CartDrawer from "@/components/CartDrawer";
import { useParams } from "react-router";
import axios from "axios";
import { toast } from "sonner";

const API_BASE = "http://localhost:3000"; // API Gateway

// Types matching backend responses
interface StoreDetail {
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
}

interface StoreDetailResponse {
  success: boolean;
  data: StoreDetail;
}

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
  isAvailable: boolean;
  category?: { id: string; name: string } | null;
}

interface ProductsResponse {
  success: boolean;
  data: ProductItem[];
}

const RestaurantDetailPage = () => {
  const { id } = useParams();
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      try {
        setLoading(true);
        const [storeRes, productsRes] = await Promise.all([
          axios.get<StoreDetailResponse>(`${API_BASE}/api/stores/${id}`),
          axios.get<ProductsResponse>(`${API_BASE}/api/products`, { params: { storeId: id } }),
        ]);

        if (storeRes.data.success && storeRes.data.data) {
          setStore(storeRes.data.data);
        } else {
          toast.error("Không tải được thông tin cửa hàng");
        }

        if (productsRes.data.success && Array.isArray(productsRes.data.data)) {
          setProducts(productsRes.data.data);
        } else {
          toast.error("Không tải được thực đơn của cửa hàng");
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Fetch restaurant detail failed", e);
        toast.error("Có lỗi khi tải dữ liệu cửa hàng");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [id]);

  const restaurantHeaderData = useMemo(() => {
    if (!store) return null;

    const image = store.cover || store.avatar || "/burger-restaurant-interior-modern.jpg";
    const address = [store.address, store.ward, store.district, store.province]
      .filter(Boolean)
      .join(", ");

    // Derive categories from products' category names
    const categories = Array.from(
      new Set(
        products
          .map((p) => p.category?.name)
          .filter((n): n is string => !!n)
      )
    );

    return {
      id: store.id,
      name: store.name,
      image,
      rating: 4.6, // mock until rating service exists
      reviewCount: 128, // mock
      deliveryTime: "20-30 phút",
      deliveryFee: "Miễn phí",
      categories,
      promo: "Ưu đãi hấp dẫn",
      distance: "1.2km",
      address: address || "Đang cập nhật",
      openTime: store.openTime && store.closeTime ? `${store.openTime} - ${store.closeTime}` : "08:00 - 22:00",
    };
  }, [store, products]);

  const menuSections = useMemo(() => {
    if (!products.length) return [] as { category: string; items: any[] }[];

    const grouped: Record<string, ProductItem[]> = {};
    for (const p of products) {
      const key = p.category?.name || "Khác";
      grouped[key] = grouped[key] || [];
      grouped[key].push(p);
    }

    return Object.entries(grouped).map(([category, items]) => ({
      category,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description || "",
        price: it.price,
        image: it.imageUrl || "/placeholder.svg",
        popular: false,
      })),
    }));
  }, [products]);

  const handleCartToggle = () => setIsCartOpen(true);
  const handleCartClose = () => setIsCartOpen(false);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="relative">
        {restaurantHeaderData && <RestaurantHeader restaurant={restaurantHeaderData} />}
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {loading && (
              <p className="text-center text-muted-foreground py-8">Đang tải thực đơn...</p>
            )}
            {!loading && menuSections.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Cửa hàng chưa có món nào.</p>
            )}
            {!loading &&
              menuSections.map((section) => (
                <MenuSection
                  key={section.category}
                  section={section}
                  restaurantId={restaurantHeaderData?.id || id || ""}
                  restaurantName={restaurantHeaderData?.name || store?.name || ""}
                />
              ))}
          </div>
        </div>

        {/* Cart Button - chỉ hiện khi có món trong giỏ */}
        <CartButton onClick={handleCartToggle} className="bottom-24" />

        {/* Cart Drawer */}
        <CartDrawer isOpen={isCartOpen} onClose={handleCartClose} />
      </main>
      <Footer />
    </div>
  );
};

export default RestaurantDetailPage;
