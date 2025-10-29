import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import redisClient from '../config/redis';
import { generateCartKey } from '../utils/cartKey';

/**
 * Middleware kiểm tra session cart
 * Đảm bảo mỗi user chỉ có thể thao tác với cart của restaurant hiện tại
 * Nếu user thêm sản phẩm từ restaurant khác, cần clear cart cũ hoặc cảnh báo
 */
export const checkSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const restaurantId = req.body.restaurantId || req.params.restaurantId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
      });
    }

    // Kiểm tra xem user có cart nào khác không
    const pattern = `cart:${userId}:*`;
    const keys = await redisClient.keys(pattern);

    // Lọc ra các cart key (không bao gồm meta key)
    const cartKeys = keys.filter(key => !key.includes(':meta:'));

    if (cartKeys.length > 0) {
      const currentCartKey = generateCartKey(userId, restaurantId);

      // Nếu có cart từ restaurant khác
      const otherRestaurantCart = cartKeys.find(key => key !== currentCartKey);

      if (otherRestaurantCart) {
        // Lấy thông tin restaurant cũ
        const oldRestaurantId = otherRestaurantCart.split(':')[2];

        return res.status(409).json({
          success: false,
          message: 'You have items from another restaurant in your cart',
          data: {
            currentRestaurantId: oldRestaurantId,
            newRestaurantId: restaurantId,
            action: 'clear_or_continue',
          },
        });
      }
    }

    // Session hợp lệ, tiếp tục
    next();
  } catch (error) {
    console.error('Check session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check session',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Middleware cho phép bỏ qua check session
 * Dùng cho các endpoint như get cart, clear cart
 */
export const optionalCheckSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Không kiểm tra conflict, chỉ verify user
  next();
};


