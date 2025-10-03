import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Interface để extend Request object
interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

// Middleware xác thực JWT token từ user-service
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Không có token, truy cập bị từ chối"
      });
    }

    // Verify token (dùng cùng JWT_SECRET với user-service)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as any;

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({
      success: false,
      message: "Token không hợp lệ"
    });
  }
};

// Middleware kiểm tra role STORE_ADMIN
export const requireStoreAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Chưa xác thực"
    });
  }

  if (req.user.role !== "STORE_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Chỉ admin cửa hàng mới có quyền quản lý sản phẩm"
    });
  }

  next();
};

// Middleware kiểm tra nhiều role
export const requireRoles = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Chưa xác thực"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện hành động này"
      });
    }

    next();
  };
};
