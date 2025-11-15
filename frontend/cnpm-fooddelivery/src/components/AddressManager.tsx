import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Edit, Trash2, Home, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

interface Address {
    id: string;
    name: string;
    phone: string;
    address: string;
    ward?: string;
    district?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    isDefault: boolean;
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface SearchResult {
    place_name: string;
    center: [number, number]; // [longitude, latitude]
    text: string;
    id: string;
    place_type: string[];
}

const AddressManager = () => {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [formData, setFormData] = useState<Partial<Address>>({
        name: "",
        phone: "",
        address: "",
        ward: "",
        district: "",
        province: "",
        latitude: undefined,
        longitude: undefined,
        isDefault: false,
    });

    // States for address search
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeoutRef = useRef<number | null>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Load addresses on component mount
    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            setIsLoading(true);
            const token = authService.getToken();

            if (!token) {
                toast.error("Vui lòng đăng nhập để xem địa chỉ");
                setIsLoading(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/addresses`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại");
                    return;
                }
                throw new Error("Failed to fetch addresses");
            }

            const data = await response.json();

            if (data.success) {
                setAddresses(data.data || []);
            }
        } catch (error) {
            console.error("Error fetching addresses:", error);
            toast.error("Không thể tải danh sách địa chỉ");
        } finally {
            setIsLoading(false);
        }
    };

    // Search address using API Gateway -> Location Service
    const searchAddress = async (query: string) => {
        if (!query || query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(
                `${API_BASE_URL}/locations/search?query=${encodeURIComponent(query)}`
            );

            if (!response.ok) {
                throw new Error("Failed to search address");
            }

            const data = await response.json();

            if (data.success && data.data) {
                setSearchResults(data.data);
                setShowResults(true);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Error searching address:", error);
            toast.error("Lỗi tìm kiếm địa chỉ");
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            searchAddress(searchQuery);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelectAddress = (result: SearchResult) => {
        setFormData((prev) => ({
            ...prev,
            address: result.place_name,
            longitude: result.center[0],
            latitude: result.center[1],
        }));
        setSearchQuery(result.place_name);
        setShowResults(false);
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            // Validation
            if (!formData.name || !formData.phone || !formData.address) {
                toast.error("Vui lòng điền đầy đủ thông tin");
                return;
            }

            const token = authService.getToken();
            if (!token) {
                toast.error("Vui lòng đăng nhập");
                return;
            }

            const url = editingAddress
                ? `${API_BASE_URL}/addresses/${editingAddress.id}`
                : `${API_BASE_URL}/addresses`;

            const method = editingAddress ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại");
                    return;
                }
                throw new Error("Failed to save address");
            }

            const data = await response.json();

            if (data.success) {
                toast.success(editingAddress ? "Cập nhật thành công!" : "Thêm thành công!", {
                    description: data.message,
                });

                // Reload addresses
                await fetchAddresses();
                setIsDialogOpen(false);
                resetForm();
            } else {
                throw new Error(data.message || "Failed to save address");
            }
        } catch (error) {
            console.error("Error saving address:", error);
            toast.error("Lỗi khi lưu địa chỉ");
        }
    };

    const handleEdit = (address: Address) => {
        setEditingAddress(address);
        setFormData({
            name: address.name,
            phone: address.phone,
            address: address.address,
            ward: address.ward,
            district: address.district,
            province: address.province,
            latitude: address.latitude,
            longitude: address.longitude,
            isDefault: address.isDefault,
        });
        setSearchQuery(address.address);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const token = authService.getToken();
            if (!token) {
                toast.error("Vui lòng đăng nhập");
                return;
            }

            const response = await fetch(`${API_BASE_URL}/addresses/${id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại");
                    return;
                }
                throw new Error("Failed to delete address");
            }

            const data = await response.json();

            if (data.success) {
                toast.success("Xóa thành công!", {
                    description: data.message,
                });
                await fetchAddresses();
            } else {
                throw new Error(data.message || "Failed to delete address");
            }
        } catch (error) {
            console.error("Error deleting address:", error);
            toast.error("Lỗi khi xóa địa chỉ");
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
            const token = authService.getToken();
            if (!token) {
                toast.error("Vui lòng đăng nhập");
                return;
            }

            const response = await fetch(`${API_BASE_URL}/addresses/${id}/default`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại");
                    return;
                }
                throw new Error("Failed to set default address");
            }

            const data = await response.json();

            if (data.success) {
                toast.success("Đã đặt làm địa chỉ mặc định!");
                await fetchAddresses();
            } else {
                throw new Error(data.message || "Failed to set default address");
            }
        } catch (error) {
            console.error("Error setting default address:", error);
            toast.error("Lỗi khi đặt địa chỉ mặc định");
        }
    };

    const resetForm = () => {
        setEditingAddress(null);
        setFormData({
            name: "",
            phone: "",
            address: "",
            ward: "",
            district: "",
            province: "",
            latitude: undefined,
            longitude: undefined,
            isDefault: false,
        });
        setSearchQuery("");
        setSearchResults([]);
        setShowResults(false);
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

                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

                    {/* Form để bật autocomplete cho các trường và xử lý submit */}
                    <form
                        autoComplete="on"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSave();
                        }}
                    >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Tên địa chỉ *</Label>
                                <Input
                                    id="name"
                                    name="address_label"
                                    autoComplete="nickname"
                                    value={formData.name || ""}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                    placeholder="Ví dụ: Nhà riêng, Công ty, Nhà bạn..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Số điện thoại *</Label>
                                <Input
                                    id="phone"
                                    name="tel"
                                    autoComplete="tel"
                                    inputMode="tel"
                                    value={formData.phone || ""}
                                    onChange={(e) => handleInputChange("phone", e.target.value)}
                                    placeholder="Số điện thoại liên hệ"
                                />
                            </div>

                            <div className="space-y-2 relative" ref={searchContainerRef}>
                                <Label htmlFor="search-address">Tìm kiếm địa chỉ *</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        id="search-address"
                                        name="street-address"
                                        autoComplete="street-address"
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                                        onFocus={() => searchResults.length > 0 && setShowResults(true)}
                                        placeholder="Nhập tên đường, quận, thành phố..."
                                        className="pl-10 pr-10"
                                    />
                                    {isSearching && (
                                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                                    )}
                                </div>

                                {/* Search Results Dropdown */}
                                {showResults && searchResults.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {searchResults.map((result, index) => (
                                            <div
                                                key={index}
                                                onClick={() => handleSelectAddress(result)}
                                                className="px-4 py-3 hover:bg-accent cursor-pointer flex items-start space-x-2 border-b last:border-b-0"
                                            >
                                                <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{result.text}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{result.place_name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {showResults && searchQuery && searchResults.length === 0 && !isSearching && (
                                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-4 text-center text-sm text-muted-foreground">
                                        Không tìm thấy kết quả
                                    </div>
                                )}
                            </div>

                            {formData.address && (
                                <div className="p-3 bg-accent/50 rounded-md">
                                    <p className="text-xs text-muted-foreground mb-1">Địa chỉ đã chọn:</p>
                                    <p className="text-sm font-medium flex items-start">
                                        <MapPin className="w-4 h-4 mr-1 mt-0.5 text-primary flex-shrink-0" />
                                        <span>{formData.address}</span>
                                    </p>
                                    {formData.latitude !== undefined && formData.longitude !== undefined && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            📍 {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    name="isDefault"
                                    checked={formData.isDefault}
                                    onChange={(e) => handleInputChange("isDefault", e.target.checked)}
                                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                                />
                                <Label htmlFor="isDefault">Đặt làm địa chỉ mặc định</Label>
                            </div>

                            {/* Buttons: Hủy (button) và Thêm/Cập nhật (submit) */}
                            <div className="flex items-center justify-end space-x-2 mt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Hủy
                                </Button>
                                <Button type="submit">
                                    {editingAddress ? "Cập nhật" : "Thêm"}
                                </Button>
                            </div>
                        </div>
                    </form>
                 </DialogContent>
             </Dialog>

            {/* Address List */}
            {isLoading ? (
                <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Đang tải danh sách địa chỉ...</p>
                </div>
            ) : addresses.length === 0 ? (
                <div className="text-center py-8">
                    <MapPin className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground mt-2">Chưa có địa chỉ nào</p>
                    <p className="text-xs text-muted-foreground">Nhấn "Thêm địa chỉ mới" để bắt đầu</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {addresses.map((address) => (
                        <Card key={address.id} className="relative">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Home className="w-4 h-4 text-muted-foreground" />
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
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-start space-x-2">
                                        <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                                        <p className="text-muted-foreground flex-1">{address.address}</p>
                                    </div>
                                    <p className="text-muted-foreground pl-6">📞 {address.phone}</p>
                                    {address.latitude && address.longitude && (
                                        <p className="text-xs text-muted-foreground pl-6">
                                            📍 {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                                        </p>
                                    )}
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
                    ))}
                </div>
            )}
        </div>
    );
};

export default AddressManager;

