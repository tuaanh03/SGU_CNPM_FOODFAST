import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Link } from "react-router";
import { MapPin, User, ClipboardList } from "lucide-react";

const Navigation = () => {
  return (
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
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <MapPin className="w-4 h-4 mr-2" />
            Quận 1, TP.HCM
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Link to="/my-orders">
            <Button variant="ghost" size="sm" className="relative">
              <ClipboardList className="w-5 h-5" />
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                3
              </Badge>
            </Button>
          </Link>
          <Link to="/profile">
            <Button variant="ghost" size="sm">
              <User className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
