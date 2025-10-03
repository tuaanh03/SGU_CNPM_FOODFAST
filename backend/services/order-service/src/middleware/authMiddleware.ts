import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Lấy token từ cookie với tên 'token' hoặc từ Authorization header
    let token = req.cookies?.token;

    // Nếu không có cookie 'token', thử lấy từ Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
    }

    if (!token) {
      res.status(401).json({ message: "Unauthorized: No token provided" });
      return;
    }

    // Sử dụng JWT_SECRET hoặc JWT_SECRET_KEY tương thích với user-service
    const jwtSecret =
      process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "secret";

    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;

    if (!decoded.userId) {
      throw new Error("Token payload is missing UserId");
    }

    req.user = { id: decoded.userId };

    next();
  } catch (error: any) {
    console.error("JWT verification error:", error);
    res
      .status(401)
      .json({ message: "Unauthorized: Invalid token", error: error.message });
  }
};
