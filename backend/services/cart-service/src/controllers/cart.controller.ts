import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import redisClient from '../config/redis';
import { generateCartKey, generateCartMetaKey, getUserCartPattern } from '../utils/cartKey';

/**
 * Thêm sản phẩm vào giỏ hàng
 * Redis Hash: key = cart:{userId}:{restaurantId}
 * Field = productId, Value = quantity
 */
export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { restaurantId, productId, quantity, productName, productPrice, productImage } = req.body;

    if (!userId || !restaurantId || !productId || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: restaurantId, productId, quantity',
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
      });
    }

    const cartKey = generateCartKey(userId, restaurantId);
    const metaKey = generateCartMetaKey(userId, restaurantId);

    // Lấy quantity hiện tại nếu có
    const currentQuantity = await redisClient.hGet(cartKey, productId);
    const newQuantity = currentQuantity ? parseInt(currentQuantity) + quantity : quantity;

    // Lưu quantity vào Redis Hash
    await redisClient.hSet(cartKey, productId, newQuantity.toString());

    // Lưu thông tin bổ sung của sản phẩm vào hash riêng (để tối ưu performance)
    const productInfoKey = `cart:product:${productId}`;
    await redisClient.hSet(productInfoKey, {
      name: productName || '',
      price: productPrice?.toString() || '0',
      image: productImage || '',
    });

    // Cập nhật metadata
    const now = new Date().toISOString();
    const metaExists = await redisClient.exists(metaKey);

    if (!metaExists) {
      await redisClient.hSet(metaKey, {
        createdAt: now,
        updatedAt: now,
        restaurantId: restaurantId,
      });
    } else {
      await redisClient.hSet(metaKey, 'updatedAt', now);
    }

    // Set TTL (7 ngày)
    const ttl = parseInt(process.env.CART_TTL || '604800');
    await redisClient.expire(cartKey, ttl);
    await redisClient.expire(metaKey, ttl);
    await redisClient.expire(productInfoKey, ttl);

    return res.status(200).json({
      success: true,
      message: 'Product added to cart',
      data: {
        productId,
        quantity: newQuantity,
        restaurantId,
      },
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add product to cart',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Lấy thông tin giỏ hàng của user tại một restaurant
 */
export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { restaurantId } = req.params;

    if (!userId || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: restaurantId',
      });
    }

    const cartKey = generateCartKey(userId, restaurantId);
    const metaKey = generateCartMetaKey(userId, restaurantId);

    // Lấy tất cả items trong cart
    const cartItems = await redisClient.hGetAll(cartKey);

    if (!cartItems || Object.keys(cartItems).length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Cart is empty',
        data: {
          items: [],
          metadata: null,
          totalItems: 0,
        },
      });
    }

    // Lấy thông tin chi tiết của từng sản phẩm
    const items = await Promise.all(
      Object.entries(cartItems).map(async ([productId, quantity]) => {
        const productInfoKey = `cart:product:${productId}`;
        const productInfo = await redisClient.hGetAll(productInfoKey);

        return {
          productId,
          quantity: parseInt(quantity),
          name: productInfo.name || '',
          price: parseFloat(productInfo.price || '0'),
          image: productInfo.image || '',
          subtotal: parseFloat(productInfo.price || '0') * parseInt(quantity),
        };
      })
    );

    // Lấy metadata
    const metadata = await redisClient.hGetAll(metaKey);

    // Tính tổng
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

    return res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      data: {
        items,
        metadata: metadata || null,
        totalItems,
        totalAmount,
        restaurantId,
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get cart',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Cập nhật số lượng sản phẩm trong giỏ hàng
 */
export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { restaurantId, productId } = req.params;
    const { quantity } = req.body;

    if (!userId || !restaurantId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity',
      });
    }

    const cartKey = generateCartKey(userId, restaurantId);
    const metaKey = generateCartMetaKey(userId, restaurantId);

    // Kiểm tra sản phẩm có tồn tại trong cart không
    const exists = await redisClient.hExists(cartKey, productId);

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart',
      });
    }

    if (quantity === 0) {
      // Xóa sản phẩm nếu quantity = 0
      await redisClient.hDel(cartKey, productId);
    } else {
      // Cập nhật quantity
      await redisClient.hSet(cartKey, productId, quantity.toString());
    }

    // Cập nhật metadata
    await redisClient.hSet(metaKey, 'updatedAt', new Date().toISOString());

    return res.status(200).json({
      success: true,
      message: quantity === 0 ? 'Product removed from cart' : 'Cart item updated',
      data: {
        productId,
        quantity,
        restaurantId,
      },
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update cart item',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Xóa một sản phẩm khỏi giỏ hàng
 */
export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { restaurantId, productId } = req.params;

    if (!userId || !restaurantId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const cartKey = generateCartKey(userId, restaurantId);
    const metaKey = generateCartMetaKey(userId, restaurantId);

    // Xóa sản phẩm
    const result = await redisClient.hDel(cartKey, productId);

    if (result === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart',
      });
    }

    // Cập nhật metadata
    await redisClient.hSet(metaKey, 'updatedAt', new Date().toISOString());

    return res.status(200).json({
      success: true,
      message: 'Product removed from cart',
      data: {
        productId,
        restaurantId,
      },
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove product from cart',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Xóa toàn bộ giỏ hàng của user tại một restaurant
 */
export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { restaurantId } = req.params;

    if (!userId || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const cartKey = generateCartKey(userId, restaurantId);
    const metaKey = generateCartMetaKey(userId, restaurantId);

    // Xóa cart và metadata
    await redisClient.del(cartKey);
    await redisClient.del(metaKey);

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: {
        restaurantId,
      },
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Xóa tất cả giỏ hàng của user (từ tất cả restaurant)
 */
export const clearAllCarts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const pattern = getUserCartPattern(userId);
    const keys = await redisClient.keys(pattern);

    // Lấy cả cart keys và meta keys
    const metaPattern = `cart:meta:${userId}:*`;
    const metaKeys = await redisClient.keys(metaPattern);

    const allKeys = [...keys, ...metaKeys];

    if (allKeys.length > 0) {
      await redisClient.del(allKeys);
    }

    return res.status(200).json({
      success: true,
      message: 'All carts cleared successfully',
      data: {
        clearedCarts: keys.length,
      },
    });
  } catch (error) {
    console.error('Clear all carts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear all carts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Lấy tất cả giỏ hàng của user (từ tất cả restaurant)
 */
export const getAllCarts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const pattern = getUserCartPattern(userId);
    const keys = await redisClient.keys(pattern);

    // Lọc ra các cart key (không bao gồm meta key)
    const cartKeys = keys.filter(key => !key.includes(':meta:'));

    if (cartKeys.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No carts found',
        data: {
          carts: [],
        },
      });
    }

    // Lấy thông tin từng cart
    const carts = await Promise.all(
      cartKeys.map(async (cartKey) => {
        const parts = cartKey.split(':');
        const restaurantId = parts[2];

        const cartItems = await redisClient.hGetAll(cartKey);
        const metaKey = generateCartMetaKey(userId, restaurantId);
        const metadata = await redisClient.hGetAll(metaKey);

        const items = await Promise.all(
          Object.entries(cartItems).map(async ([productId, quantity]) => {
            const productInfoKey = `cart:product:${productId}`;
            const productInfo = await redisClient.hGetAll(productInfoKey);

            return {
              productId,
              quantity: parseInt(quantity),
              name: productInfo.name || '',
              price: parseFloat(productInfo.price || '0'),
              image: productInfo.image || '',
            };
          })
        );

        return {
          restaurantId,
          items,
          metadata,
          totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'All carts retrieved successfully',
      data: {
        carts,
      },
    });
  } catch (error) {
    console.error('Get all carts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get all carts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

