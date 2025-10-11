import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import crypto from "crypto";
// Interface để extend Request object
interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

// Middleware xác thực JWT token
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

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY || "secret") as any;

    // Kiểm tra token đã bị thu hồi (đã logout) hay chưa
    const jti = decoded?.jti as string | undefined;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const revoked = await prisma.revokedToken.findFirst({
      where: {
        AND: [
          {
            OR: [
              ...(jti ? ([{ jti }] as any[]) : []),
              { tokenHash }
            ]
          },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    if (revoked) {
      return res.status(401).json({
        success: false,
        message: "Token đã bị thu hồi. Vui lòng đăng nhập lại."
      });
    }

    // Kiểm tra user còn tồn tại và đang hoạt động
    const userId = decoded?.userId as string | undefined;
    const email = decoded?.email as string | undefined;
    const role = decoded?.role as string | undefined;

    if (!userId || !email || !role) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ"
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa hoặc không tồn tại"
      });
    }

    // Gán thông tin user vào request để các handler khác dùng
    req.user = { userId, email, role };

    return next();
  } catch (err: any) {
    // Token hết hạn hoặc không hợp lệ
    const message = err?.name === "TokenExpiredError" ? "Token đã hết hạn" : "Token không hợp lệ";
    return res.status(401).json({ success: false, message });
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
      message: "Chỉ admin cửa hàng mới có quyền thực hiện hành động này"
    });
  }

  next();
};

// Middleware kiểm tra role CUSTOMER
export const requireCustomer = (
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

  if (req.user.role !== "CUSTOMER") {
    return res.status(403).json({
      success: false,
      message: "Chỉ khách hàng mới có quyền thực hiện hành động này"
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
