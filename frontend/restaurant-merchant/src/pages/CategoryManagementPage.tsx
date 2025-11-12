import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { productService, type Category } from "@/services/product.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Plus, Tag, MoreVertical, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CategoryManagementPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await productService.getCategories();
      setCategories(response.data);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi tải danh mục");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
    } else {
      setEditingCategory(null);
      setCategoryName("");
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setCategoryName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      toast.error("Vui lòng nhập tên danh mục");
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        // Update
        await productService.updateCategory(editingCategory.id, categoryName.trim());
        toast.success("Cập nhật danh mục thành công!");
      } else {
        // Create
        await productService.createCategory(categoryName.trim());
        toast.success("Thêm danh mục thành công!");
      }
      handleCloseDialog();
      await loadCategories();
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi lưu danh mục");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const productCount = category._count?.products || 0;

    if (productCount > 0) {
      toast.error(`Không thể xóa danh mục có ${productCount} món ăn`);
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa danh mục "${category.name}"?`)) {
      return;
    }

    try {
      await productService.deleteCategory(category.id);
      toast.success("Đã xóa danh mục");
      await loadCategories();
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi xóa danh mục");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-6 h-6" />
                Quản lý danh mục
              </CardTitle>
              <CardDescription>
                Tạo và quản lý danh mục cho món ăn
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm danh mục
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">
                Chưa có danh mục nào. Tạo danh mục đầu tiên!
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Thêm danh mục
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên danh mục</TableHead>
                  <TableHead>Số món ăn</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {category._count?.products || 0} món
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {new Date(category.createdAt).toLocaleDateString("vi-VN")}
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
                          <DropdownMenuItem onClick={() => handleOpenDialog(category)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(category)}
                            className="text-red-600"
                            disabled={(category._count?.products || 0) > 0}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Xóa
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

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Chỉnh sửa danh mục" : "Thêm danh mục mới"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? "Cập nhật tên danh mục"
                  : "Nhập tên danh mục để tạo mới"}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="categoryName">
                Tên danh mục <span className="text-red-500">*</span>
              </Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ví dụ: Món chính, Đồ uống, Tráng miệng..."
                required
                disabled={submitting}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={submitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting
                  ? "Đang lưu..."
                  : editingCategory
                  ? "Cập nhật"
                  : "Thêm danh mục"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoryManagementPage;

