import { Button } from "@/components/ui/button";

const Banner = () => {
  return (
    <section className="bg-gradient-to-r from-orange-400 to-red-500 w-full">
      <div className="max-w-full mx-auto px-4 py-16">
        <div className="text-center text-white">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Giao Hàng Thực Phẩm Nhanh Chóng
          </h2>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            Thưởng thức món ăn yêu thích với dịch vụ giao hàng siêu tốc
          </p>
          
          <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center space-x-2">
              <span className="text-2xl">🚚</span>
              <span className="font-semibold">Giao hàng trong 30 phút</span>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center space-x-2">
              <span className="text-2xl">🍕</span>
              <span className="font-semibold">Món ăn tươi ngon</span>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center space-x-2">
              <span className="text-2xl">💝</span>
              <span className="font-semibold">Khuyến mãi hấp dẫn</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            <Button size="lg" className="bg-white text-orange-500 hover:bg-gray-100 font-semibold px-8 py-3">
              Đặt món ngay
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-orange-500 font-semibold px-8 py-3">
              Xem thực đơn
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Banner;
