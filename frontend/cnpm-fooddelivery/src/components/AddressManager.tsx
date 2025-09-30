import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Edit, Trash2, Home, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Address {
  id: string;
  type: "home" | "work" | "other";
  name: string;
  address: string;
  district: string;
  city: string;
  phone: string;
  isDefault: boolean;
}

const addressTypes = {
  home: { label: "Nhà riêng", icon: Home },
  work: { label: "Công ty", icon: Building2 },
  other: { label: "Khác", icon: MapPin },
};

const AddressManager = () => {
  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: "1",
      type: "home",
      name: "Nhà riêng",
      address: "123 Nguyễn Huệ, Phường Bến Nghé",
      district: "Quận 1",
      city: "TP. Hồ Chí Minh",
      phone: "0901234567",
      isDefault: true,
    },
    {
      id: "2",
      type: "work",
      name: "Công ty ABC",
      address: "456 Lê Lợi, Phường Bến Thành",
      district: "Quận 1",
      city: "TP. Hồ Chí Minh",
      phone: "0901234567",
      isDefault: false,
    },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<Omit<Address, "id">>({
    type: "home",
    name: "",
    address: "",
    district: "",
    city: "TP. Hồ Chí Minh",
    phone: "",
    isDefault: false,
  });

  const handleInputChange = (field: keyof Omit<Address, "id">, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (editingAddress) {
      // Update existing address
      setAddresses((prev) =>
        prev.map((addr) =>
          addr.id === editingAddress.id
            ? { ...formData, id: editingAddress.id }
            : formData.isDefault
              ? { ...addr, isDefault: false }
              : addr,
        ),
      );
      toast.success("Cập nhật thành công!", {
        description: "Địa chỉ đã được cập nhật.",
      });
    } else {
      // Add new address
      const newAddress: Address = {
        ...formData,
        id: Date.now().toString(),
      };

      if (formData.isDefault) {
        setAddresses((prev) => [
          ...prev.map((addr) => ({ ...addr, isDefault: false })),
          newAddress,
        ]);
      } else {
        setAddresses((prev) => [...prev, newAddress]);
      }

      toast.success("Thêm thành công!", {
        description: "Địa chỉ mới đã được thêm.",
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      type: address.type,
      name: address.name,
      address: address.address,
      district: address.district,
      city: address.city,
      phone: address.phone,
      isDefault: address.isDefault,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setAddresses((prev) => prev.filter((addr) => addr.id !== id));
    toast.success("Xóa thành công!", {
      description: "Địa chỉ đã được xóa.",
    });
  };

  const handleSetDefault = (id: string) => {
    setAddresses((prev) =>
      prev.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      })),
    );
    toast.success("Đã đặt làm địa chỉ mặc định!");
  };

  const resetForm = () => {
    setEditingAddress(null);
    setFormData({
      type: "home",
      name: "",
      address: "",
      district: "",
      city: "TP. Hồ Chí Minh",
      phone: "",
      isDefault: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Add Address Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button onClick={resetForm} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Thêm địa chỉ mới
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress
                ? "Cập nhật thông tin địa chỉ giao hàng"
                : "Thêm địa chỉ giao hàng mới để đặt món nhanh chóng hơn"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Loại địa chỉ</Label>
              <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value as "home" | "work" | "other")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(addressTypes).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Tên địa chỉ</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Ví dụ: Nhà riêng, Công ty..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ chi tiết</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Số nhà, tên đường, phường/xã"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="district">Quận/Huyện</Label>
                <Input
                  id="district"
                  value={formData.district}
                  onChange={(e) => handleInputChange("district", e.target.value)}
                  placeholder="Quận/Huyện"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Tỉnh/Thành phố</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder="Tỉnh/Thành phố"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="Số điện thoại liên hệ"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => handleInputChange("isDefault", e.target.checked)}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
              />
              <Label htmlFor="isDefault">Đặt làm địa chỉ mặc định</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave}>
              {editingAddress ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address List */}
      <div className="space-y-4">
        {addresses.map((address) => {
          const AddressIcon = addressTypes[address.type].icon;
          return (
            <Card key={address.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AddressIcon className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base">{address.name}</CardTitle>
                    {address.isDefault && (
                      <Badge variant="default" className="text-xs">
                        Mặc định
                      </Badge>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(address)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(address.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      disabled={address.isDefault}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{address.address}</p>
                  <p>{address.district}, {address.city}</p>
                  <p>📞 {address.phone}</p>
                </div>
                {!address.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(address.id)}
                    className="mt-3"
                  >
                    Đặt làm mặc định
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AddressManager;
