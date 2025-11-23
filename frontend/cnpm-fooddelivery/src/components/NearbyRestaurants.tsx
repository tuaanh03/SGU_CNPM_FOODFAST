import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Restaurant } from "@/services/restaurant.service";

interface NearbyRestaurantsProps {
  restaurants: Restaurant[];
  loading: boolean;
  onSelectRestaurant: (restaurant: Restaurant) => void;
  selectedRestaurantId?: string;
}

export const NearbyRestaurants = ({
  restaurants,
  loading,
  onSelectRestaurant,
  selectedRestaurantId,
}: NearbyRestaurantsProps) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Đang tìm nhà hàng gần bạn...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (restaurants.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            Không có nhà hàng nào trong bán kính 10km
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Vui lòng chọn địa chỉ khác hoặc mở rộng bán kính tìm kiếm
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Nhà hàng gần bạn ({restaurants.length})
        </h3>
        <p className="text-sm text-muted-foreground">
          Trong vòng 10km
        </p>
      </div>

      <div className="grid gap-3">
        {restaurants.map((restaurant, index) => (
          <Card
            key={restaurant.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedRestaurantId === restaurant.id
                ? "border-primary border-2"
                : "hover:border-primary/50"
            }`}
            onClick={() => onSelectRestaurant(restaurant)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Restaurant Image */}
                <img
                  src={restaurant.avatar || "https://via.placeholder.com/80"}
                  alt={restaurant.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />

                {/* Restaurant Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-semibold truncate">{restaurant.name}</h4>
                      {restaurant.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {restaurant.description}
                        </p>
                      )}
                    </div>
                    {index === 0 && (
                      <Badge variant="default" className="bg-green-500 shrink-0">
                        Gần nhất
                      </Badge>
                    )}
                  </div>

                  {/* Address */}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {restaurant.address}, {restaurant.ward}, {restaurant.district}
                  </p>

                  {/* Distance & Status */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">
                        Cách bạn {restaurant.distance?.toFixed(1)} km
                      </span>
                    </div>

                    {restaurant.openTime && restaurant.closeTime && (
                      <div className="text-xs text-muted-foreground">
                        {restaurant.openTime} - {restaurant.closeTime}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

