import axios, { AxiosError } from 'axios';

// API Gateway URL - tự động chọn theo môi trường
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

console.log('🔧 Cart Helper Config:');
console.log('  - API_GATEWAY_URL:', API_GATEWAY_URL);

interface CartItem {
  productId: string;
  quantity: number;
  storeId: string;
}

interface CartResponse {
  success: boolean;
  data?: {
    items: Array<{
      productId: string;
      quantity: number;
      name?: string;
      price?: number;
      image?: string;
      subtotal?: number;
    }>;
    restaurantId: string;
    totalItems?: number;
    totalAmount?: number;
    metadata?: any;
  };
  message?: string;
}

/**
 * Lấy giỏ hàng của user từ Cart Service (qua API Gateway)
 * @param token - JWT token từ request header
 * @param storeId - ID của cửa hàng
 */
export async function fetchUserCart(token: string, storeId: string): Promise<CartItem[]> {
  try {
    // Gọi qua API Gateway để có headers x-user-id, x-user-email
    const response = await axios.get<CartResponse>(
      `${API_GATEWAY_URL}/api/cart/${storeId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      return [];
    }

    return response.data.data.items.map((item: { productId: string; quantity: number }) => ({
      ...item,
      storeId: response.data.data!.restaurantId,
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error('❌ Cart Service error:', axiosError.response?.data || axiosError.message);
      throw new Error(`Cart Service error: ${axiosError.response?.data?.message || axiosError.message}`);
    }
    throw error;
  }
}

/**
 * Xóa giỏ hàng sau khi tạo order thành công
 * @param token - JWT token từ request header
 * @param storeId - ID của cửa hàng
 */
export async function clearUserCart(token: string, storeId: string): Promise<void> {
  try {
    // Gọi qua API Gateway
    await axios.delete(`${API_GATEWAY_URL}/api/cart/${storeId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('✅ Cart cleared successfully for store:', storeId);
  } catch (error) {
    console.error('⚠️ Error clearing cart:', error);
    // Không throw error vì đây chỉ là cleanup, không ảnh hưởng đến order
  }
}
