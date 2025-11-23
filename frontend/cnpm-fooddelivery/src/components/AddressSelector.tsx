import { useState, useEffect } from "react";
import { MapPin, Plus, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addressService } from "@/services/address.service";
import type { Address } from "@/services/address.service";
import { toast } from "sonner";

interface AddressSelectorProps {
  onAddressSelect: (address: Address) => void;
  selectedAddressId?: string;
}

export const AddressSelector = ({
  onAddressSelect,
  selectedAddressId,
}: AddressSelectorProps) => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const data = await addressService.getAddresses();
      setAddresses(data);

      // Tự động chọn địa chỉ mặc định
      const defaultAddress = data.find((addr) => addr.isDefault);
      if (defaultAddress && !selectedAddressId) {
        onAddressSelect(defaultAddress);
      }
    } catch (error: any) {
      console.error("Error loading addresses:", error);
      // Không hiển thị toast error nếu chưa đăng nhập
      if (!error.message?.includes("đăng nhập")) {
        toast.error("Không thể tải danh sách địa chỉ");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">
              Đang tải địa chỉ...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (addresses.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">
            Bạn chưa có địa chỉ nào được lưu
          </p>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Thêm địa chỉ mới
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Chọn địa chỉ giao hàng
          </span>
          <Button variant="ghost" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Thêm mới
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {addresses.map((address) => (
          <div
            key={address.id}
            onClick={() => onAddressSelect(address)}
            className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary ${
              selectedAddressId === address.id
                ? "border-primary bg-primary/5"
                : "hover:bg-gray-50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{address.name}</p>
                  {address.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      Mặc định
                    </Badge>
                  )}
                  {selectedAddressId === address.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{address.phone}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {address.address}, {address.ward}, {address.district},{" "}
                  {address.province}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

