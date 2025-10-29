import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

// Middleware tin tưởng thông tin từ API Gateway
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Lấy thông tin user từ headers do API Gateway gửi xuống
    const userId = req.headers["x-user-id"] as string;
    const email = req.headers["x-user-email"] as string;
    const role = req.headers["x-user-role"] as string;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized: No user information" });
      return;
    }

    // Tin tưởng thông tin từ API Gateway
    req.user = { id: userId };

    next();
  } catch (error: any) {
    console.error("Auth error:", error);
    res.status(401).json({ message: "Unauthorized", error: error.message });
  }
};
