import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { addressService } from "@/services/address.service";
import type { Address } from "@/services/address.service";
import { toast } from "sonner";

interface AddressContextType {
  selectedAddress: Address | null;
  setSelectedAddress: (address: Address | null) => void;
  addresses: Address[];
  loading: boolean;
  refreshAddresses: () => Promise<void>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export const AddressProvider = ({ children }: { children: ReactNode }) => {
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const data = await addressService.getAddresses();
      setAddresses(data);

      // Tự động chọn địa chỉ mặc định nếu chưa có địa chỉ được chọn
      if (!selectedAddress && data.length > 0) {
        const defaultAddr = data.find((addr) => addr.isDefault) || data[0];
        setSelectedAddress(defaultAddr);

        // Lưu vào localStorage
        localStorage.setItem("selected_address_id", defaultAddr.id);
      }
    } catch (error: any) {
      console.error("Error loading addresses:", error);
      // Không hiển thị toast nếu chưa đăng nhập
      if (!error.message?.includes("đăng nhập")) {
        toast.error("Không thể tải danh sách địa chỉ");
      }
    } finally {
      setLoading(false);
    }
  };

  // Load addresses khi component mount
  useEffect(() => {
    loadAddresses();

    // Restore selected address từ localStorage
    const savedAddressId = localStorage.getItem("selected_address_id");
    if (savedAddressId && addresses.length > 0) {
      const savedAddr = addresses.find((a) => a.id === savedAddressId);
      if (savedAddr) {
        setSelectedAddress(savedAddr);
      }
    }
  }, []);

  // Lưu selected address vào localStorage khi thay đổi
  useEffect(() => {
    if (selectedAddress) {
      localStorage.setItem("selected_address_id", selectedAddress.id);
    }
  }, [selectedAddress]);

  const refreshAddresses = async () => {
    await loadAddresses();
  };

  return (
    <AddressContext.Provider
      value={{
        selectedAddress,
        setSelectedAddress,
        addresses,
        loading,
        refreshAddresses,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
};

export const useAddress = () => {
  const context = useContext(AddressContext);
  if (context === undefined) {
    throw new Error("useAddress must be used within an AddressProvider");
  }
  return context;
};

