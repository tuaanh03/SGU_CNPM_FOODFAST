import { MapPin, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Address } from "@/services/address.service";

interface AddressSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addresses: Address[];
  selectedAddress: Address | null;
  onSelectAddress: (address: Address) => void;
}

export const AddressSelectorDialog = ({
  open,
  onOpenChange,
  addresses,
  selectedAddress,
  onSelectAddress,
}: AddressSelectorDialogProps) => {
  const handleSelect = (address: Address) => {
    onSelectAddress(address);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Chọn địa chỉ giao hàng
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {addresses.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                Bạn chưa có địa chỉ nào được lưu
              </p>
              <Button variant="outline" size="sm">
                Thêm địa chỉ mới
              </Button>
            </div>
          ) : (
            addresses.map((address) => (
              <div
                key={address.id}
                onClick={() => handleSelect(address)}
                className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                  selectedAddress?.id === address.id
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
                      {selectedAddress?.id === address.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {address.phone}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {address.address}, {address.ward}, {address.district},{" "}
                      {address.province}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

