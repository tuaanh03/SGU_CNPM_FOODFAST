import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import API_BASE_URL from "@/config/api";

const AdminRegisterPage = () => {
  const { registerAdmin } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    // address fields for restaurant
    address: "",
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    ward: "",
    district: "",
    province: "",
  });
  // address search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = "Email là bắt buộc";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (!formData.password) {
      newErrors.password = "Mật khẩu là bắt buộc";
    } else if (formData.password.length < 6) {
      newErrors.password = "Mật khẩu phải có ít nhất 6 ký tự";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    if (!formData.name) {
      newErrors.name = "Tên là bắt buộc";
    }

    if (!formData.phone) {
      newErrors.phone = "Số điện thoại là bắt buộc";
    } else if (!/^[0-9]{10,11}$/.test(formData.phone)) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Include address fields in payload; backend may accept or ignore extras
      await registerAdmin({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        ward: formData.ward,
        district: formData.district,
        province: formData.province,
      } as any);
      navigate("/admin");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Search address function (calls API Gateway -> location service)
  const searchAddress = async (q: string) => {
    if (!q || q.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/locations/search?query=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Failed to search address");
      const data = await res.json();
      if (data.success && data.data) {
        setSearchResults(data.data);
        setShowResults(true);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Error searching address:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // debounced effect for searchQuery
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    // @ts-ignore node timeout
    searchTimeoutRef.current = setTimeout(() => searchAddress(searchQuery), 400) as unknown as number;
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectAddress = (result: any) => {
    setFormData((prev) => ({
      ...prev,
      address: result.place_name,
      longitude: result.center ? result.center[0] : prev.longitude,
      latitude: result.center ? result.center[1] : prev.latitude,
    }));
    setSearchQuery(result.place_name);
    setShowResults(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500/10 via-background to-red-500/10 p-4">
      <Card className="w-full max-w-md shadow-lg border-orange-200">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-3xl">🔐</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Đăng ký Admin</CardTitle>
          <CardDescription className="text-center">
            Tạo tài khoản quản trị mới
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                disabled={loading}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={loading}
              />
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                name="tel"
                autoComplete="tel"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="0123456789"
                required
                disabled={loading}
              />
              {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
            </div>

            {/* Address search and selection for restaurant */}
            <div className="space-y-2 relative" ref={searchContainerRef}>
              <Label htmlFor="search-address">Địa chỉ cửa hàng</Label>
              <div className="relative">
                <Input
                  id="search-address"
                  name="street-address"
                  autoComplete="street-address"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  placeholder="Nhập tên đường, quận, thành phố..."
                  className="pl-3"
                  disabled={loading}
                />
                {isSearching && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                )}
               </div>

              {showResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((r, idx) => (
                    <div key={idx} className="px-3 py-2 hover:bg-accent cursor-pointer" onClick={() => handleSelectAddress(r)}>
                      <div className="text-sm font-medium truncate">{r.text}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.place_name}</div>
                    </div>
                  ))}
                </div>
              )}

              {formData.address && (
                <p className="text-xs text-muted-foreground mt-1">Địa chỉ đã chọn: {formData.address}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Đang đăng ký..." : "Đăng ký"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Đã có tài khoản?{" "}
              <Link to="/admin/login" className="text-orange-600 hover:underline font-medium">
                Đăng nhập
              </Link>
            </div>

            <div className="text-center text-sm">
              <Link to="/register" className="text-blue-600 hover:underline">
                Đăng ký với tài khoản khách hàng
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRegisterPage;

