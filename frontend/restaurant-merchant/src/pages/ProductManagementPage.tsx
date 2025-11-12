import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { productService, type Product, type Category } from "@/services/product.service";
import { storeService, type Store } from "@/services/store.service";
import MerchantLayout from "@/components/MerchantLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Tag,
  Package
} from "lucide-react";
import { toast } from "sonner";

const ProductManagementPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [store, setStore] = useState<Store | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load store info
      const storeResponse = await storeService.getMyStore();
      setStore(storeResponse.data);

      // Load categories
      const categoriesResponse = await productService.getCategories();
      setCategories(categoriesResponse.data);

      // Load products
      await loadProducts(storeResponse.data.id);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (storeId: string) => {
    try {
      const response = await productService.getProducts({ storeId });
      setProducts(response.data);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải danh sách món ăn");
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      await productService.updateProductAvailability(product.id, {
        isAvailable: !product.isAvailable,
      });

      toast.success(
        product.isAvailable
          ? "Đã tắt món ăn"
          : "Đã bật món ăn"
      );

      if (store) {
        await loadProducts(store.id);
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi cập nhật trạng thái");
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa món "${productName}"?`)) {
      return;
    }

    try {
      await productService.deleteProduct(productId);
      toast.success("Đã xóa món ăn");
      if (store) {
        await loadProducts(store.id);
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi xóa món ăn");
    }
  };

  // Filter products
  const filteredProducts = products.filter((product) => {
    // Search query
    if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter
    if (selectedCategory !== "all" && product.categoryId !== selectedCategory) {
      return false;
    }

    // Availability filter
    if (availabilityFilter === "available" && !product.isAvailable) {
      return false;
    }
    if (availabilityFilter === "unavailable" && product.isAvailable) {
      return false;
    }

    return true;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <MerchantLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6" />
              Quản lý thực đơn
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Quản lý món ăn của {store?.name}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/merchant/products/categories")}
            >
              <Tag className="w-4 h-4 mr-2" />
              Danh mục
            </Button>
            <Button onClick={() => navigate("/merchant/products/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm món mới
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Tìm kiếm món ăn..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả danh mục</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Availability Filter */}
              <div>
                <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="available">Đang bán</SelectItem>
                    <SelectItem value="unavailable">Tạm ngưng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Danh sách món ăn ({filteredProducts.length})</CardTitle>
            <CardDescription>
              Quản lý và cập nhật thông tin món ăn của bạn
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">
                  {products.length === 0
                    ? "Chưa có món ăn nào. Thêm món đầu tiên của bạn!"
                    : "Không tìm thấy món ăn phù hợp"}
                </p>
                {products.length === 0 && (
                  <Button
                    className="mt-4"
                    onClick={() => navigate("/merchant/products/new")}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm món mới
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Ảnh</TableHead>
                    <TableHead>Tên món</TableHead>
                    <TableHead>Danh mục</TableHead>
                    <TableHead>Giá</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.category ? (
                          <Badge variant="outline">{product.category.name}</Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">Chưa phân loại</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatPrice(product.price)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {product.sku}
                      </TableCell>
                      <TableCell>
                        {product.isAvailable ? (
                          <Badge className="bg-green-100 text-green-800">Đang bán</Badge>
                        ) : (
                          <Badge variant="secondary">Tạm ngưng</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => navigate(`/merchant/products/${product.id}/edit`)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleAvailability(product)}
                            >
                              {product.isAvailable ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-2" />
                                  Tắt bán
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Bật bán
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Xóa món
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MerchantLayout>
  );
};

export default ProductManagementPage;

