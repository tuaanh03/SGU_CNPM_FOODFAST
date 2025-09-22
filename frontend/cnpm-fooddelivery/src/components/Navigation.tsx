import { Button } from "./ui/button";
import { Link } from "react-router";

const Navigation = () => {
  return (
    <nav className="bg-orange-500 shadow-md w-full">
      <div className="max-w-full mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Link to="/" className="text-white text-2xl font-bold hover:text-orange-200 transition-colors">
              🍕 FastFood
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-white hover:text-orange-200 transition-colors">Trang chủ</Link>
            <Link to="/products" className="text-white hover:text-orange-200 transition-colors">Thực đơn</Link>
            <a href="#" className="text-white hover:text-orange-200 transition-colors">Về chúng tôi</a>
            <a href="#" className="text-white hover:text-orange-200 transition-colors">Liên hệ</a>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" className="bg-white text-orange-500 border-white hover:bg-orange-50">
              Đăng nhập
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">
              Đăng ký
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
