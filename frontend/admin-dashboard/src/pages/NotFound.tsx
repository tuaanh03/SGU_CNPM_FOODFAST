import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
            <div className="text-center">
                <h1 className="text-9xl font-bold text-gray-200">404</h1>
                <h2 className="mt-4 text-3xl font-bold text-gray-900">Trang không tồn tại</h2>
                <p className="mt-2 text-gray-600">
                    Xin lỗi, trang bạn đang tìm kiếm không tồn tại.
                </p>
                <Button className="mt-6" onClick={() => navigate("/")}>
                    <Home className="mr-2 h-4 w-4" />
                    Về Trang Chủ
                </Button>
            </div>
        </div>
    );
};

export default NotFound;

