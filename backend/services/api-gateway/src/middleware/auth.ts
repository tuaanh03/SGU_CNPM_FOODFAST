import { Request, Response, NextFunction } from "express";
import axios from "axios";

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

// Middleware xác thực token và kiểm tra revoked từ user-service
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Không có token"
      });
      return;
    }

    // Gọi user-service để verify token và kiểm tra revoked
    const verifyResponse = await axios.post(
      `${process.env.USER_SERVICE_URL || "http://user-service:1000"}/auth/verify-token`,
      { token },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    if (!verifyResponse.data.success) {
      res.status(401).json({
        success: false,
        message: verifyResponse.data.message || "Token không hợp lệ"
      });
      return;
    }

    // Lấy thông tin user từ response
    const userData = verifyResponse.data.data;
    req.user = {
      userId: userData.userId,
      email: userData.email,
      role: userData.role
    };

    next();
  } catch (error: any) {
    if (error.response) {
      res.status(error.response.status || 401).json({
        success: false,
        message: error.response.data?.message || "Token không hợp lệ"
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: "Lỗi xác thực token"
    });
  }
};
