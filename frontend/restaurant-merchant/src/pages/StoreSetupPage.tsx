import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/auth-context";
import { storeService, type CreateStoreRequest } from "@/services/store.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Store } from "lucide-react";
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
                                    <Input
                                        id="address"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="123 Nguyễn Huệ"
                                        required
                                        disabled={loading}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="ward">
                                            Phường/Xã <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="ward"
                                            name="ward"
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