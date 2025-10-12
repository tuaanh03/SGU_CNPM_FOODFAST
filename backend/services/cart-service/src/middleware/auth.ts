import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

// Middleware tin tưởng thông tin từ API Gateway
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Lấy thông tin user từ headers do API Gateway gửi xuống
    const userId = req.headers['x-user-id'] as string;
    const email = req.headers['x-user-email'] as string;
    const role = req.headers['x-user-role'] as string;

    if (!userId || !email) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Tin tưởng thông tin từ API Gateway
    req.user = {
      id: userId,
      email: email,
      role: role,
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
};
