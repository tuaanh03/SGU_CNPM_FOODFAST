import { RestaurantCard } from "@/components/RestaurantCard"

const restaurants = [
	{
		id: 1,
		name: "Burger King Việt Nam",
		image: "/burger-restaurant-storefront.png",
		rating: 4.5,
		deliveryTime: "20-30 phút",
		deliveryFee: "15.000đ",
		categories: ["Đồ ăn nhanh", "Burger"],
		promo: "Giảm 30% đơn từ 99k",
		distance: "1.2km",
	},
	{
		id: 2,
		name: "Phở Hà Nội",
		image: "/vietnamese-pho-restaurant.png",
		rating: 4.7,
		deliveryTime: "25-35 phút",
		deliveryFee: "12.000đ",
		categories: ["Món Việt", "Phở"],
		promo: "Mua 1 tặng 1",
		distance: "0.8km",
	},
	{
		id: 3,
		name: "Sushi Tokyo",
		image: "/japanese-sushi-restaurant.png",
		rating: 4.6,
		deliveryTime: "30-40 phút",
		deliveryFee: "20.000đ",
		categories: ["Món Nhật", "Sushi"],
		promo: "Freeship đơn từ 150k",
		distance: "2.1km",
	},
	{
		id: 4,
		name: "Pizza Hut",
		image: "/pizza-restaurant-interior.png",
		rating: 4.3,
		deliveryTime: "25-35 phút",
		deliveryFee: "18.000đ",
		categories: ["Món Tây", "Pizza"],
		promo: "Combo 2 pizza chỉ 199k",
		distance: "1.5km",
	},
	{
		id: 5,
		name: "Trà Sữa Gong Cha",
		image: "/bubble-tea-shop-modern.jpg",
		rating: 4.4,
		deliveryTime: "15-25 phút",
		deliveryFee: "10.000đ",
		categories: ["Đồ uống", "Trà sữa"],
		promo: "Buy 2 get 1 free",
		distance: "0.5km",
	},
	{
		id: 6,
		name: "Bánh Mì Hội An",
		image: "/vietnamese-banh-mi-sandwich-shop.jpg",
		rating: 4.8,
		deliveryTime: "10-20 phút",
		deliveryFee: "8.000đ",
		categories: ["Món Việt", "Bánh mì"],
		promo: "Giảm 20% toàn menu",
		distance: "0.3km",
	},
]

interface RestaurantListProps {
	loading?: boolean
}

const RestaurantList = ({ loading = false }: RestaurantListProps) => {
	if (loading) {
		return (
			<div className="text-center py-8">
				<p className="text-muted-foreground">Đang tải nhà hàng...</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold text-foreground">Nhà hàng đối tác</h2>
				<p className="text-muted-foreground">{restaurants.length} nhà hàng</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{restaurants.map((restaurant) => (
					<RestaurantCard key={restaurant.id} restaurant={restaurant} />
				))}
			</div>
		</div>
	)
}

export default RestaurantList
