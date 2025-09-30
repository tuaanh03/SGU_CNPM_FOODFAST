import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const categories = [
	{ id: "all", name: "Tất cả", icon: "🍽️" },
	{ id: "fastfood", name: "Đồ ăn nhanh", icon: "🍔" },
	{ id: "vietnamese", name: "Món Việt", icon: "🍜" },
	{ id: "asian", name: "Món Á", icon: "🍱" },
	{ id: "western", name: "Món Tây", icon: "🍝" },
	{ id: "drinks", name: "Đồ uống", icon: "🧋" },
	{ id: "dessert", name: "Tráng miệng", icon: "🍰" }
];

interface ProductFilterProps {
	selectedCategory?: string;
	onCategoryChange?: (category: string) => void;
}

const ProductFilter = ({
	selectedCategory = "all",
	onCategoryChange
}: ProductFilterProps) => {
	return (
		<ScrollArea className="w-full whitespace-nowrap">
			<div className="flex space-x-3 pb-4">
				{categories.map((category) => (
					<Button
						key={category.id}
						variant={
							category.id === selectedCategory ? "default" : "outline"
						}
						className="flex-shrink-0 h-12 px-6 rounded-full"
						onClick={() => onCategoryChange?.(category.id)}
					>
						<span className="mr-2 text-lg">{category.icon}</span>
						{category.name}
					</Button>
				))}
			</div>
		</ScrollArea>
	);
};

export default ProductFilter;
