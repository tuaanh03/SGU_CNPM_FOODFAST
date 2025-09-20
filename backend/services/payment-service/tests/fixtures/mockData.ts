// Mock data cho Payment Service tests
import { Request, Response } from 'express';

// Extend Request interface để thêm user property
interface AuthenticatedRequest extends Request {
  user?: typeof mockUser;
}

// Mock User data
export const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'user@example.com',
  name: 'Nguyễn Văn A'
};

// Mock Order data
export const mockOrder = {
  orderId: 'order-550e8400-e29b-41d4-a716-446655440000',
  userId: mockUser.id,
  amount: 12000000,
  item: 'iPhone 15 Pro Max',
  status: 'pending'
};

// Mock VNPay payment response
export const mockVNPayResponse = {
  success: true,
  paymentIntentId: '1737176208560',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Version=2.1.0&vnp_Command=pay&vnp_TmnCode=TESTCODE&vnp_Amount=1200000000&vnp_CreateDate=20250117083648&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Order%20order-550e8400-e29b-41d4-a716-446655440000%20-%20iPhone%2015%20Pro%20Max&vnp_OrderType=other&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A3003%2Fvnpay_return&vnp_TxnRef=1737176208560&vnp_SecureHash=abcd1234'
};

// Mock VNPay callback query parameters
export const mockVNPayCallback = {
  success: {
    vnp_ResponseCode: '00',
    vnp_TxnRef: '1737176208560',
    vnp_Amount: '1200000000',
    vnp_OrderInfo: 'Order order-550e8400-e29b-41d4-a716-446655440000 - iPhone 15 Pro Max'
  },
  failed: {
    vnp_ResponseCode: '24',
    vnp_TxnRef: '1737176208560',
    vnp_Amount: '1200000000',
    vnp_OrderInfo: 'Order order-550e8400-e29b-41d4-a716-446655440000 - iPhone 15 Pro Max'
  }
};

// Mock Kafka message từ order service
export const mockKafkaMessage = {
  orderId: mockOrder.orderId,
  userId: mockOrder.userId,
  amount: mockOrder.amount,
  items: [
    {
      productId: '550e8400-e29b-41d4-a716-446655440001',
      quantity: 1
    }
  ],
  timestamp: '2025-01-17T08:36:28.560Z'
};

// Mock Request và Response - sử dụng type assertion để tránh lỗi TypeScript
export const mockRequest = (body?: any, query?: any, params?: any): Partial<AuthenticatedRequest> => ({
  body: body || {},
  query: query || {},
  params: params || {},
  user: mockUser
} as Partial<AuthenticatedRequest>);

export const mockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

// Mock environment variables
export const mockEnvVars = {
  VNPAY_TMN_CODE: 'TESTCODE',
  VNPAY_HASH_SECRET: 'TESTSECRET123',
  VNPAY_API_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  VNPAY_RETURN_URL: 'http://localhost:3003/vnpay_return',
  FRONTEND_URL: 'http://localhost:3000'
};

// Mock payment event data
export const mockPaymentEvent = {
  orderId: mockOrder.orderId,
  userId: mockOrder.userId,
  email: 'system@vnpay.com',
  amount: mockOrder.amount,
  item: mockOrder.item,
  paymentStatus: 'pending',
  paymentIntentId: '1737176208560',
  paymentUrl: mockVNPayResponse.paymentUrl
};

// Export AuthenticatedRequest type để sử dụng ở file khác
export type { AuthenticatedRequest };
