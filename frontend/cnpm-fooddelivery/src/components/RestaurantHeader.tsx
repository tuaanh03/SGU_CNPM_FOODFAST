import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Clock, Truck, MapPin, Heart, Share2 } from "lucide-react";

interface RestaurantData {
  id: number;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: string;
  categories: string[];
  promo: string;
  distance: string;
  address: string;
  openTime: string;
}

interface RestaurantHeaderProps {
  restaurant: RestaurantData;
}

const RestaurantHeader = ({ restaurant }: RestaurantHeaderProps) => {
  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="h-64 md:h-80 relative overflow-hidden">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Promo Badge */}
        <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
          {restaurant.promo}
        </Badge>

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button variant="secondary" size="sm" className="rounded-full">
            <Heart className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" className="rounded-full">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Restaurant Info */}
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {restaurant.name}
              </h1>

              <div className="flex flex-wrap gap-2 mb-4">
                {restaurant.categories.map((category) => (
                  <Badge key={category} variant="secondary" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-foreground">{restaurant.rating}</span>
                  <span>({restaurant.reviewCount} đánh giá)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {restaurant.deliveryTime}
                </div>
                <div className="flex items-center gap-1">
                  <Truck className="w-4 h-4" />
                  {restaurant.deliveryFee}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {restaurant.distance}
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                <p><strong>Địa chỉ:</strong> {restaurant.address}</p>
                <p><strong>Giờ mở cửa:</strong> {restaurant.openTime}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Button className="w-full md:w-auto min-w-40">
                Đặt bàn ngay
              </Button>
              <Button variant="outline" className="w-full md:w-auto">
                Xem đánh giá
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantHeader;
