import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal } from "lucide-react";

const Banner = () => {
  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-balance text-foreground">
          Đặt đồ ăn ngon, giao nhanh tận nơi
        </h1>
        <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
          Khám phá hàng ngàn món ăn từ các nhà hàng đối tác uy tín. Giao hàng nhanh chóng trong 30 phút!
        </p>
      </div>

      <div className="flex gap-3 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Tìm kiếm món ăn, nhà hàng..."
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button variant="outline" size="lg" className="px-4 bg-transparent">
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </main>
  );
};

export default Banner;
