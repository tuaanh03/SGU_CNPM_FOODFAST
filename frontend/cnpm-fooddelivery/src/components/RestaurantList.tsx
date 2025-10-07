import { RestaurantCard } from "@/components/RestaurantCard"

// Shape expected by RestaurantCard
export interface RestaurantItem {
	id: string | number
	name: string
	image: string
	rating: number
	deliveryTime: string
	deliveryFee: string
	categories: string[]
	promo: string
	distance: string
}

interface RestaurantListProps {
	restaurants?: RestaurantItem[]
	loading?: boolean
}

const RestaurantList = ({ restaurants = [], loading = false }: RestaurantListProps) => {
	if (loading) {
		return (
			<div className="text-center py-8">
				<p className="text-muted-foreground">Đang tải nhà hàng...</p>
			</div>
		)
	}

	if (!restaurants.length) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-2xl font-bold text-foreground">Nhà hàng đối tác</h2>
					<p className="text-muted-foreground">0 nhà hàng</p>
				</div>
				<p className="text-muted-foreground">Hiện chưa có nhà hàng nào khả dụng.</p>
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
