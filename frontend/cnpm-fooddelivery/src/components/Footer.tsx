const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white w-full">
      <div className="max-w-full mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Thông tin công ty */}
          <div className="space-y-4">
            <h4 className="text-2xl font-bold text-orange-400">🍕 FastFood</h4>
            <p className="text-gray-300">
              Dịch vụ giao hàng thực phẩm nhanh chóng và chất lượng nhất thành phố.
            </p>
            <div className="flex space-x-4">
              <span className="text-2xl cursor-pointer hover:text-orange-400 transition-colors">📱</span>
              <span className="text-2xl cursor-pointer hover:text-orange-400 transition-colors">📧</span>
              <span className="text-2xl cursor-pointer hover:text-orange-400 transition-colors">🌐</span>
            </div>
          </div>

          {/* Dịch vụ */}
          <div className="space-y-4">
            <h5 className="text-lg font-semibold text-orange-400">Dịch vụ</h5>
            <ul className="space-y-2 text-gray-300">
              <li><a href="#" className="hover:text-orange-400 transition-colors">Giao hàng tận nơi</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Đặt món trực tuyến</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Khuyến mãi đặc biệt</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Chương trình thành viên</a></li>
            </ul>
          </div>

          {/* Liên kết nhanh */}
          <div className="space-y-4">
            <h5 className="text-lg font-semibold text-orange-400">Liên kết</h5>
            <ul className="space-y-2 text-gray-300">
              <li><a href="#" className="hover:text-orange-400 transition-colors">Về chúng tôi</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Thực đơn</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Liên hệ</a></li>
              <li><a href="#" className="hover:text-orange-400 transition-colors">Chính sách bảo mật</a></li>
            </ul>
          </div>

          {/* Thông tin liên hệ */}
          <div className="space-y-4">
            <h5 className="text-lg font-semibold text-orange-400">Liên hệ</h5>
            <div className="space-y-2 text-gray-300">
              <p className="flex items-center space-x-2">
                <span>📞</span>
                <span>1900 1234</span>
              </p>
              <p className="flex items-center space-x-2">
                <span>✉️</span>
                <span>info@fastfood.vn</span>
              </p>
              <p className="flex items-center space-x-2">
                <span>📍</span>
                <span>123 Đường ABC, Quận 1, TP.HCM</span>
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © 2025 FastFood. Tất cả quyền được bảo lưu.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
