import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Clock, Truck, MapPin } from "lucide-react"
import { Link } from "react-router"

interface Restaurant {
  id: number
  name: string
  image: string
  rating: number
  deliveryTime: string
  deliveryFee: string
  categories: string[]
  promo: string
  distance: string
}

interface RestaurantCardProps {
  restaurant: Restaurant
}

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  return (
    <Link to={`/restaurant/${restaurant.id}`}>
      <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <div className="relative">
          <img
            src={restaurant.image || "/placeholder.svg"}
            alt={restaurant.name}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">{restaurant.promo}</Badge>
          <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-md text-sm flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            {restaurant.rating}
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {restaurant.name}
            </h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {restaurant.categories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
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

          <Button className="w-full" size="sm">
            Xem menu
          </Button>
        </CardContent>
      </Card>
    </Link>
  )
}
