import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Link } from "react-router";
import { MapPin, User, ClipboardList, LogOut, LogIn, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useAddress } from "@/contexts/address-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AddressSelectorDialog } from "./AddressSelectorDialog";

const Navigation = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { selectedAddress, addresses, setSelectedAddress } = useAddress();
  const [showAddressDialog, setShowAddressDialog] = useState(false);

  // Format địa chỉ hiển thị ngắn gọn
  const getAddressDisplay = () => {
    if (!selectedAddress) {
      return "Chọn địa chỉ giao hàng";
    }
    return `${selectedAddress.ward}, ${selectedAddress.district}`;
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">🍕</span>
              </div>
              <span className="font-bold text-xl text-foreground">FastFood</span>
            </Link>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddressDialog(true)}
              className={`text-muted-foreground ${!selectedAddress ? "text-orange-500" : ""}`}
            >
              <MapPin className="w-4 h-4 mr-2" />
              <span className="max-w-[200px] truncate">{getAddressDisplay()}</span>
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </div>

        <div className="flex items-center space-x-2">
          {isAuthenticated ? (
            <>
              <Link to="/my-orders">
                <Button variant="ghost" size="sm" className="relative">
                  <ClipboardList className="w-5 h-5" />
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    3
                  </Badge>
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline text-sm">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Hồ sơ</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-orders" className="cursor-pointer">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      <span>Đơn hàng của tôi</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm">
                <LogIn className="w-4 h-4 mr-2" />
                Đăng nhập
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>

      {/* Address Selector Dialog */}
      <AddressSelectorDialog
        open={showAddressDialog}
        onOpenChange={setShowAddressDialog}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onSelectAddress={setSelectedAddress}
      />
    </>
  );
};

export default Navigation;
