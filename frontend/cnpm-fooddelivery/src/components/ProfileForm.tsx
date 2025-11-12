import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Save, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatar: string;
}

const ProfileForm = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    email: "",
    phone: "",
    bio: "",
    avatar: "",
  });

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        bio: "",
        avatar: "",
      });
    }
  }, [user]);

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);

    // TODO: Call API to update profile
    // For now, just simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast.success("Cập nhật thành công!", {
      description: "Thông tin hồ sơ của bạn đã được lưu.",
    });

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Avatar className="w-20 h-20">
            <AvatarImage src={profile.avatar || "/placeholder.svg"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
              <User className="w-8 h-8" />
            </AvatarFallback>
          </Avatar>
          <Button size="sm" variant="secondary" className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0">
            <Camera className="w-4 h-4" />
          </Button>
        </div>
        <div>
          <h3 className="font-semibold text-lg">{profile.name}</h3>
          <p className="text-muted-foreground">Thành viên từ tháng 1/2024</p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Họ và tên</Label>
          <Input
            id="name"
            value={profile.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Nhập họ và tên"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="Nhập email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input
            id="phone"
            value={profile.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="Nhập số điện thoại"
          />
        </div>

        <div className="space-y-2 md:col-span-1">
          <Label htmlFor="bio">Giới thiệu</Label>
          <Textarea
            id="bio"
            value={profile.bio}
            onChange={(e) => handleInputChange("bio", e.target.value)}
            placeholder="Viết vài dòng về bản thân..."
            rows={3}
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">47</div>
            <div className="text-sm text-muted-foreground">Đơn hàng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent">12</div>
            <div className="text-sm text-muted-foreground">Nhà hàng yêu thích</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-chart-3">4.8</div>
            <div className="text-sm text-muted-foreground">Đánh giá trung bình</div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading} className="min-w-32">
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>Đang lưu...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>Lưu thay đổi</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ProfileForm;
