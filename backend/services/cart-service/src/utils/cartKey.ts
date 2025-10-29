/**
 * Tạo key cho Redis Cart
 * Format: cart:{userId}:{restaurantId}
 * Mỗi user và restaurant sẽ có một session cart riêng biệt
 */
export const generateCartKey = (userId: string, restaurantId: string): string => {
  return `cart:${userId}:${restaurantId}`;
};

/**
 * Tạo key cho metadata của cart
 * Lưu trữ thông tin như createdAt, updatedAt, restaurantName, etc.
 */
export const generateCartMetaKey = (userId: string, restaurantId: string): string => {
  return `cart:meta:${userId}:${restaurantId}`;
};

/**
 * Lấy pattern để tìm tất cả cart của một user
 */
export const getUserCartPattern = (userId: string): string => {
  return `cart:${userId}:*`;
};

/**
 * Parse cart key để lấy userId và restaurantId
 */
export const parseCartKey = (key: string): { userId: string; restaurantId: string } | null => {
  const parts = key.split(':');
  if (parts.length === 3 && parts[0] === 'cart') {
    return {
      userId: parts[1],
      restaurantId: parts[2],
    };
  }
  return null;
};

