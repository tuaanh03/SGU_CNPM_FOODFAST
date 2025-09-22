import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const ProductFilter = () => {
  const categories = [
    { id: "all", name: "Tất cả", count: 24 },
    { id: "pizza", name: "Pizza", count: 8 },
    { id: "burger", name: "Burger", count: 6 },
    { id: "chicken", name: "Gà", count: 5 },
    { id: "pasta", name: "Mì", count: 3 },
    { id: "drinks", name: "Đồ uống", count: 2 }
  ];

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={category.id === "all" ? "default" : "outline"}
                className={`${
                  category.id === "all"
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "border-gray-300 text-gray-700 hover:bg-orange-50 hover:border-orange-300"
                }`}
              >
                {category.name}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {category.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
            <option>Sắp xếp theo giá</option>
            <option>Giá thấp đến cao</option>
            <option>Giá cao đến thấp</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
            <option>Đánh giá</option>
            <option>5 sao</option>
            <option>4 sao trở lên</option>
            <option>3 sao trở lên</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default ProductFilter;
