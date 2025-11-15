import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { storeService, type CreateStoreRequest } from "@/services/store.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Store } from "lucide-react";
import API_BASE_URL from "@/config/api";
import { toast } from "sonner";

const StoreSetupPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState<CreateStoreRequest>({
        name: "",
        description: "",
        address: "",
        ward: "",
        district: "",
        province: "",
        phone: user?.phone || "",
        email: user?.email || "",
        openTime: "08:00",
        closeTime: "22:00",
    });

    // Address search states (like AddressManager)
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeoutRef = useRef<number | null>(null);
    const searchContainerRef = useRef<HTMLDivElement | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.name.trim()) {
            toast.error("Vui lòng nhập tên cửa hàng");
            return;
        }
        if (!formData.address.trim() || !formData.ward.trim() || !formData.district.trim() || !formData.province.trim()) {
            toast.error("Vui lòng nhập đầy đủ địa chỉ");
            return;
        }

        setLoading(true);
        try {
            await storeService.createStore(formData);
            toast.success("Tạo cửa hàng thành công!");
            navigate("/merchant");
        } catch (error: any) {
            toast.error(error.message || "Lỗi khi tạo cửa hàng");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/merchant/login");
    };

    // Search address using API gateway -> location service
    const searchAddress = async (q: string) => {
        if (!q || q.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`${API_BASE_URL}/locations/search?query=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error('Failed to search address');
            const data = await res.json();
            if (data.success && data.data) {
                setSearchResults(data.data);
                setShowResults(true);
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error('Error searching address:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounce searchQuery
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        // @ts-ignore - Node timeout typing
        searchTimeoutRef.current = setTimeout(() => {
            searchAddress(searchQuery);
        }, 500) as unknown as number;

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]);

    // Click outside to close results
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectAddress = (result: any) => {
        setFormData((prev) => ({
            ...prev,
            address: result.place_name,
            // if location result has center [lng, lat]
            ...(result.center ? { longitude: result.center[0], latitude: result.center[1] } as any : {}),
        }));
        setSearchQuery(result.place_name);
        setShowResults(false);
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-500/10 via-background to-indigo-500/10">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Store className="w-6 h-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-blue-600">Thiết lập cửa hàng</h1>
                    </div>
                    <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Xin chào, <strong>{user?.name}</strong>
            </span>
                        <Button variant="outline" size="sm" onClick={handleLogout}>
                            Đăng xuất
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 py-8 max-w-3xl">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl">Chào mừng đến với hệ thống Merchant!</CardTitle>
                        <CardDescription>
                            Bạn chưa có cửa hàng nào. Vui lòng tạo cửa hàng đầu tiên của bạn để bắt đầu.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Thông tin cơ bản */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Thông tin cơ bản</h3>

                                <div className="space-y-2">
                                    <Label htmlFor="name">
                                        Tên cửa hàng <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Nhà hàng ABC"
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
                                        placeholder="Mô tả về cửa hàng của bạn..."
                                        rows={3}
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Địa chỉ */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Địa chỉ</h3>

                                <div className="space-y-2">
                                    <Label htmlFor="address">
                                        Số nhà, đường <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="relative" ref={searchContainerRef}>
                                        <Input
                                            id="search-address"
                                            name="street-address"
                                            autoComplete="street-address"
                                            value={searchQuery}
                                            onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                                            onFocus={() => searchResults.length > 0 && setShowResults(true)}
                                            placeholder="Nhập tên đường, quận, thành phố..."
                                            required
                                            disabled={loading}
                                        />
                                        {isSearching && (
                                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                            </div>
                                        )}

                                        {/* Search Results Dropdown */}
                                        {showResults && searchResults.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {searchResults.map((r, idx) => (
                                                    <div key={idx} className="px-4 py-2 hover:bg-accent cursor-pointer" onClick={() => handleSelectAddress(r)}>
                                                        <div className="text-sm font-medium truncate">{r.text}</div>
                                                        <div className="text-xs text-muted-foreground truncate">{r.place_name}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="ward">
                                            Phường/Xã <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="ward"
                                            name="ward"
                                            autoComplete="address-level3"
                                            value={formData.ward}
                                            onChange={handleChange}
                                            placeholder="Bến Nghé"
                                            required
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="district">
                                            Quận/Huyện <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="district"
                                            name="district"
                                            autoComplete="address-level2"
                                            value={formData.district}
                                            onChange={handleChange}
                                            placeholder="Quận 1"
                                            required
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="province">
                                            Tỉnh/Thành phố <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="province"
                                            name="province"
                                            autoComplete="address-level1"
                                            value={formData.province}
                                            onChange={handleChange}
                                            placeholder="TP. Hồ Chí Minh"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Thông tin liên hệ */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Thông tin liên hệ</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Số điện thoại</Label>
                                        <Input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="0901234567"
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="store@example.com"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Giờ hoạt động */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Giờ hoạt động</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="openTime">Giờ mở cửa</Label>
                                        <Input
                                            id="openTime"
                                            name="openTime"
                                            type="time"
                                            value={formData.openTime}
                                            onChange={handleChange}
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="closeTime">Giờ đóng cửa</Label>
                                        <Input
                                            id="closeTime"
                                            name="closeTime"
                                            type="time"
                                            value={formData.closeTime}
                                            onChange={handleChange}
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end gap-4 pt-4">
                                <Button type="button" variant="outline" onClick={handleLogout} disabled={loading}>
                                    Hủy
                                </Button>
                                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {loading ? "Đang tạo..." : "Tạo cửa hàng"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default StoreSetupPage;