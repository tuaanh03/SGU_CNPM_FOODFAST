import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { productService, type Category, type CreateProductRequest } from "@/services/product.service";
import { storeService } from "@/services/store.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, Package } from "lucide-react";
import { toast } from "sonner";

const ProductFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storeId, setStoreId] = useState<string>("");

  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    price: "",
    description: "",
    imageUrl: "",
    categoryId: "",
    isAvailable: true,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load store
      const storeResponse = await storeService.getMyStore();
      setStoreId(storeResponse.data.id);

      // Load categories
      const categoriesResponse = await productService.getCategories();
      setCategories(categoriesResponse.data);

      // Load product if edit mode
      if (isEditMode && id) {
        const productResponse = await productService.getProductById(id);
        const product = productResponse.data;
        setFormData({
          sku: product.sku,
          name: product.name,
          price: String(product.price),
          description: product.description || "",
          imageUrl: product.imageUrl || "",
          categoryId: product.categoryId || "",
          isAvailable: product.isAvailable,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải dữ liệu");
      navigate("/merchant/products");
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên món ăn");
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error("Vui lòng nhập giá hợp lệ");
      return;
    }
    if (!formData.sku.trim()) {
      toast.error("Vui lòng nhập mã SKU");
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && id) {
        // Update product
        await productService.updateProduct(id, {
          ...formData,
          price: parseFloat(formData.price),
        });
        toast.success("Cập nhật món ăn thành công!");
      } else {
        // Create product
        const createData: CreateProductRequest = {
          ...formData,
          price: parseFloat(formData.price),
          storeId,
        };
        await productService.createProduct(createData);
        toast.success("Thêm món ăn thành công!");
      }
      navigate("/merchant/products");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi lưu món ăn");
    } finally {
      setLoading(false);
    }
  };

  const generateSKU = () => {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData((prev) => ({ ...prev, sku: `SKU-${randomStr}` }));
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/merchant/products")}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-6 h-6" />
            {isEditMode ? "Chỉnh sửa món ăn" : "Thêm món ăn mới"}
          </CardTitle>
          <CardDescription>
            {isEditMode
              ? "Cập nhật thông tin món ăn"
              : "Điền thông tin để thêm món ăn mới vào thực đơn"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Thông tin cơ bản */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Thông tin cơ bản</h3>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Tên món ăn <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ví dụ: Phở bò đặc biệt"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Mô tả chi tiết về món ăn..."
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">
                    Giá (VNĐ) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="50000"
                    required
                    disabled={loading}
                    min="0"
                    step="1000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Danh mục</Label>
                  <Select
                    value={formData.categoryId || "none"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, categoryId: value === "none" ? "" : value }))
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không chọn</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* SKU và Trạng thái */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Thông tin quản lý</h3>

              <div className="space-y-2">
                <Label htmlFor="sku">
                  Mã SKU <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="sku"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="SKU-XXXXXX"
                    required
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateSKU}
                    disabled={loading}
                  >
                    Tạo tự động
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Mã SKU duy nhất để quản lý sản phẩm
                </p>
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={formData.isAvailable ? "true" : "false"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, isAvailable: value === "true" }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Đang bán</SelectItem>
                    <SelectItem value="false">Tạm ngưng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hình ảnh */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Hình ảnh</h3>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL hình ảnh</Label>
                <Input
                  id="imageUrl"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Nhập URL hình ảnh món ăn (tính năng upload đang phát triển)
                </p>
              </div>

              {formData.imageUrl && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Xem trước:</p>
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-full max-w-xs rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "";
                      toast.error("URL hình ảnh không hợp lệ");
                    }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/merchant/products")}
                disabled={loading}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading
                  ? "Đang lưu..."
                  : isEditMode
                  ? "Cập nhật món ăn"
                  : "Thêm món ăn"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductFormPage;

