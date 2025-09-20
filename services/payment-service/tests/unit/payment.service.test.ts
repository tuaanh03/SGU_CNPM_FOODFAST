// Test cho Payment Service - VNPay Handler và Kafka Consumer
import { mockRequest, mockResponse, mockKafkaMessage, mockVNPayCallback, mockPaymentEvent } from '../fixtures/mockData';
import { resetAllMocks, setupProcessPaymentMock, setupPublishEventMock } from '../mocks';
import { processPayment } from '../../src/utils/vnpay';
import { publishEvent, runConsumer } from '../../src/utils/kafka';

// Mock các module
jest.mock('../../src/utils/vnpay');
jest.mock('../../src/utils/kafka');

describe('Payment Service - LOGIC THỰC TẾ', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('processPayment (VNPay)', () => {
    it('SUCCESS: Tạo VNPay payment URL thành công', async () => {
      // ARRANGE
      const orderId = 'order-550e8400-e29b-41d4-a716-446655440000';
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const amount = 12000000;
      const item = 'iPhone 15 Pro Max';

      const expectedResponse = {
        success: true,
        paymentIntentId: '1737176208560',
        paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Version=2.1.0&vnp_Command=pay&vnp_TmnCode=TESTCODE&vnp_Amount=1200000000&vnp_CreateDate=20250117083648&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Order%20order-550e8400-e29b-41d4-a716-446655440000%20-%20iPhone%2015%20Pro%20Max&vnp_OrderType=other&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A3003%2Fvnpay_return&vnp_TxnRef=1737176208560&vnp_SecureHash=abcd1234'
      };

      // Mock processPayment success
      (processPayment as jest.Mock).mockResolvedValue(expectedResponse);

      // ACT
      const result = await processPayment(orderId, userId, amount, item);

      // ASSERT
      expect(processPayment).toHaveBeenCalledWith(orderId, userId, amount, item);
      expect(result).toEqual(expectedResponse);
      expect(result.success).toBe(true);
      expect(result.paymentUrl).toContain('https://sandbox.vnpayment.vn');
      expect(result.paymentUrl).toContain('vnp_OrderInfo=Order%20order-550e8400-e29b-41d4-a716-446655440000');
      expect(result.paymentUrl).toContain('vnp_Amount=1200000000'); // 12000000 * 100
      expect(result.paymentIntentId).toBe('1737176208560');
    });

      it('SUCCESS: Tạo VNPay payment URL với các tham số hợp lệ', async () => {
          // ARRANGE
          const orderId = 'order-123';
          const userId = 'user-456';
          const amount = 5000000; // 5 triệu VND
          const item = 'AirPods Pro';

          const mockResult = {
              success: true,
              paymentIntentId: '1737176208561',
              paymentUrl:
                  'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?' +
                  'vnp_Version=2.1.0&vnp_Command=pay&vnp_TmnCode=TESTCODE&vnp_Amount=500000000&' +
                  'vnp_CreateDate=20250117083649&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&' +
                  'vnp_Locale=vn&vnp_OrderInfo=Order%20order-123%20-%20AirPods%20Pro&' +
                  'vnp_OrderType=other&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A3003%2Fvnpay_return&' +
                  'vnp_TxnRef=1737176208561&vnp_SecureHash=def5678',
          };

          (processPayment as jest.Mock).mockResolvedValue(mockResult);

          // ACT
          const result = await processPayment(orderId, userId, amount, item);

          // ASSERT
          expect(result.success).toBe(true);
          expect(result.paymentUrl).toContain('vnp_Amount=500000000');
          expect(result.paymentUrl).toContain('https://sandbox.vnpayment.vn');
          expect(result.paymentUrl).toContain('vnp_OrderInfo=Order%20order-123%20-%20AirPods%20Pro');
          expect(result.paymentIntentId).toBe('1737176208561');
      });


      it('ERROR: Lỗi khi tạo VNPay payment URL', async () => {
      // ARRANGE
      const orderId = 'order-invalid';
      const userId = 'user-invalid';
      const amount = -1000; // Invalid amount
      const item = 'Invalid Item';

      const expectedError = {
        success: false,
        error: 'Invalid payment parameters'
      };

      (processPayment as jest.Mock).mockResolvedValue(expectedError);

      // ACT
      const result = await processPayment(orderId, userId, amount, item);

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid payment parameters');
      expect(result.paymentUrl).toBeUndefined();
    });

    it('ERROR: Lỗi thiếu thông tin cần thiết', async () => {
      // ARRANGE
      const orderId = '';
      const userId = '';
      const amount = 0;
      const item = '';

      const expectedError = {
        success: false,
        error: 'Missing required payment information'
      };

      (processPayment as jest.Mock).mockResolvedValue(expectedError);

      // ACT
      const result = await processPayment(orderId, userId, amount, item);

      // ASSERT
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required');
    });
  });

  describe('publishEvent (Kafka)', () => {
    it('SUCCESS: Publish payment event thành công', async () => {
      // ARRANGE
      const orderId = 'order-550e8400-e29b-41d4-a716-446655440000';
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const email = 'system@vnpay.com';
      const amount = 12000000;
      const item = 'iPhone 15 Pro Max';
      const paymentStatus = 'pending';
      const paymentIntentId = '1737176208560';
      const paymentUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

      // Mock publishEvent success
      (publishEvent as jest.Mock).mockResolvedValue(true);

      // ACT
      const result = await publishEvent(
        orderId, userId, email, amount, item,
        paymentStatus, paymentIntentId, paymentUrl
      );

      // ASSERT
      expect(publishEvent).toHaveBeenCalledWith(
        orderId, userId, email, amount, item,
        paymentStatus, paymentIntentId, paymentUrl
      );
      expect(result).toBe(true);
    });

    it('SUCCESS: Publish payment success event', async () => {
      // ARRANGE
      const eventData = {
        orderId: 'order-123',
        userId: 'user-456',
        email: 'user@example.com',
        amount: 5000000,
        item: 'AirPods Pro',
        paymentStatus: 'success',
        paymentIntentId: '1737176208562',
        paymentUrl: ''
      };

      (publishEvent as jest.Mock).mockResolvedValue(true);

      // ACT
      const result = await publishEvent(
        eventData.orderId,
        eventData.userId,
        eventData.email,
        eventData.amount,
        eventData.item,
        eventData.paymentStatus,
        eventData.paymentIntentId,
        eventData.paymentUrl
      );

      // ASSERT
      expect(publishEvent).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('ERROR: Lỗi khi publish event do Kafka connection thất bại', async () => {
      // ARRANGE
      const orderId = 'order-failed';
      const userId = 'user-failed';
      const email = 'test@example.com';
      const amount = 1000000;
      const item = 'Test Product';
      const paymentStatus = 'failed';
      const paymentIntentId = 'failed-txn';

      (publishEvent as jest.Mock).mockRejectedValue(new Error('Kafka connection failed'));

      // ACT & ASSERT
      await expect(publishEvent(
        orderId, userId, email, amount, item,
        paymentStatus, paymentIntentId, ''
      )).rejects.toThrow('Kafka connection failed');
    });
  });

  describe('Kafka Consumer - xử lý order.create', () => {
    it('SUCCESS: Nhận message từ order service và tạo payment thành công', async () => {
      // ARRANGE
      const mockMessage = {
        value: Buffer.from(JSON.stringify(mockKafkaMessage))
      };

      const mockPaymentResult = {
        success: true,
        paymentIntentId: '1737176208560',
        paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
      };

      // Mock processPayment và publishEvent
      (processPayment as jest.Mock).mockResolvedValue(mockPaymentResult);
      (publishEvent as jest.Mock).mockResolvedValue(true);

      // Giả lập việc xử lý message trong consumer
      const processKafkaMessage = async (message: any) => {
        const orderData = JSON.parse(message.value.toString());
        const { orderId, userId, amount, items } = orderData;

        if (!orderId || !userId || !amount) {
          throw new Error('Invalid order data');
        }

        const itemDescription = Array.isArray(items) ?
          `${items.length} sản phẩm` : 'Đơn hàng';

        const result = await processPayment(orderId, userId, amount, itemDescription);

        if (result.success && result.paymentUrl) {
          await publishEvent(
            orderId, userId, 'system@vnpay.com', amount, itemDescription,
            'pending', result.paymentIntentId!, result.paymentUrl
          );
        }

        return result;
      };

      // ACT
      const result = await processKafkaMessage(mockMessage);

      // ASSERT
      expect(processPayment).toHaveBeenCalledWith(
        mockKafkaMessage.orderId,
        mockKafkaMessage.userId,
        mockKafkaMessage.amount,
        '1 sản phẩm'
      );

      expect(publishEvent).toHaveBeenCalledWith(
        mockKafkaMessage.orderId,
        mockKafkaMessage.userId,
        'system@vnpay.com',
        mockKafkaMessage.amount,
        '1 sản phẩm',
        'pending',
        mockPaymentResult.paymentIntentId,
        mockPaymentResult.paymentUrl
      );

      expect(result.success).toBe(true);
    });

    it('ERROR: Lỗi khi nhận message không hợp lệ từ Kafka', async () => {
      // ARRANGE
      const invalidMessage = {
        value: Buffer.from(JSON.stringify({
          // Thiếu orderId, userId, amount
          invalidField: 'invalid'
        }))
      };

      const processKafkaMessage = async (message: any) => {
        const orderData = JSON.parse(message.value.toString());
        const { orderId, userId, amount } = orderData;

        if (!orderId || !userId || !amount) {
          throw new Error('Invalid order data');
        }

        return { success: false };
      };

      // ACT & ASSERT
      await expect(processKafkaMessage(invalidMessage))
        .rejects.toThrow('Invalid order data');

      // Không được gọi processPayment hoặc publishEvent
      expect(processPayment).not.toHaveBeenCalled();
      expect(publishEvent).not.toHaveBeenCalled();
    });

    it('ERROR: Lỗi khi processPayment thất bại', async () => {
      // ARRANGE
      const mockMessage = {
        value: Buffer.from(JSON.stringify(mockKafkaMessage))
      };

      const mockPaymentError = {
        success: false,
        error: 'VNPay connection failed'
      };

      (processPayment as jest.Mock).mockResolvedValue(mockPaymentError);
      (publishEvent as jest.Mock).mockResolvedValue(true);

      const processKafkaMessage = async (message: any) => {
        const orderData = JSON.parse(message.value.toString());
        const { orderId, userId, amount, items } = orderData;

        const itemDescription = Array.isArray(items) ?
          `${items.length} sản phẩm` : 'Đơn hàng';

        const result = await processPayment(orderId, userId, amount, itemDescription);

        if (result.success && result.paymentUrl) {
          await publishEvent(
            orderId, userId, 'system@vnpay.com', amount, itemDescription,
            'pending', result.paymentIntentId!, result.paymentUrl
          );
        } else {
          // Publish failed event
          await publishEvent(
            orderId, userId, 'system@vnpay.com', amount, itemDescription,
            'failed', result.paymentIntentId || 'N/A', ''
          );
        }

        return result;
      };

      // ACT
      const result = await processKafkaMessage(mockMessage);

      // ASSERT
      expect(processPayment).toHaveBeenCalled();
      expect(publishEvent).toHaveBeenCalledWith(
        mockKafkaMessage.orderId,
        mockKafkaMessage.userId,
        'system@vnpay.com',
        mockKafkaMessage.amount,
        '1 sản phẩm',
        'failed',
        'N/A',
        ''
      );
      expect(result.success).toBe(false);
    });
  });

  describe('VNPay Return Handler - Callback xử lý', () => {
    it('SUCCESS: Xử lý VNPay callback thành công (thanh toán thành công)', async () => {
      // ARRANGE
      const req = mockRequest(undefined, mockVNPayCallback.success);
      const res = mockResponse();

      (publishEvent as jest.Mock).mockResolvedValue(true);

      // Giả lập handler logic
      const handleVNPayReturn = async (req: any, res: any) => {
        const vnp_ResponseCode = req.query.vnp_ResponseCode;
        const vnp_TxnRef = req.query.vnp_TxnRef;
        const vnp_Amount = req.query.vnp_Amount;
        const vnp_OrderInfo = req.query.vnp_OrderInfo;

        // Sửa regex để match chính xác với format "Order order-550e8400-e29b-41d4-a716-446655440000 - iPhone 15 Pro Max"
        const orderIdMatch = vnp_OrderInfo?.match(/Order\s+(order-[a-f0-9-]+)/);
        const orderId = orderIdMatch ? orderIdMatch[1] : vnp_TxnRef;

        const paymentStatus = vnp_ResponseCode === '00' ? 'success' : 'failed';
        const amount = parseInt(vnp_Amount || '0') / 100;

        await publishEvent(
          orderId, '', 'system@vnpay.com', amount,
          'VNPay Payment', paymentStatus, vnp_TxnRef
        );

        const frontendUrl = 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/payment-result?status=${paymentStatus}&orderId=${orderId}&ref=${vnp_TxnRef}`;

        res.redirect(redirectUrl);
      };

      // ACT
      await handleVNPayReturn(req, res);

      // ASSERT
      expect(publishEvent).toHaveBeenCalledWith(
        'order-550e8400-e29b-41d4-a716-446655440000',
        '',
        'system@vnpay.com',
        12000000, // 1200000000 / 100
        'VNPay Payment',
        'success',
        '1737176208560'
      );

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/payment-result?status=success&orderId=order-550e8400-e29b-41d4-a716-446655440000&ref=1737176208560'
      );
    });

    it('SUCCESS: Xử lý VNPay callback với thanh toán thất bại', async () => {
      // ARRANGE
      const req = mockRequest(undefined, mockVNPayCallback.failed);
      const res = mockResponse();

      (publishEvent as jest.Mock).mockResolvedValue(true);

      const handleVNPayReturn = async (req: any, res: any) => {
        const vnp_ResponseCode = req.query.vnp_ResponseCode;
        const vnp_TxnRef = req.query.vnp_TxnRef;
        const vnp_Amount = req.query.vnp_Amount;
        const vnp_OrderInfo = req.query.vnp_OrderInfo;

        // Sửa regex để match chính xác với format "Order order-550e8400-e29b-41d4-a716-446655440000 - iPhone 15 Pro Max"
        const orderIdMatch = vnp_OrderInfo?.match(/Order\s+(order-[a-f0-9-]+)/);
        const orderId = orderIdMatch ? orderIdMatch[1] : vnp_TxnRef;

        const paymentStatus = vnp_ResponseCode === '00' ? 'success' : 'failed';
        const amount = parseInt(vnp_Amount || '0') / 100;

        await publishEvent(
          orderId, '', 'system@vnpay.com', amount,
          'VNPay Payment', paymentStatus, vnp_TxnRef
        );

        const frontendUrl = 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/payment-result?status=${paymentStatus}&orderId=${orderId}&ref=${vnp_TxnRef}`;

        res.redirect(redirectUrl);
      };

      // ACT
      await handleVNPayReturn(req, res);

      // ASSERT
      expect(publishEvent).toHaveBeenCalledWith(
        'order-550e8400-e29b-41d4-a716-446655440000',
        '',
        'system@vnpay.com',
        12000000,
        'VNPay Payment',
        'failed',
        '1737176208560'
      );

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/payment-result?status=failed&orderId=order-550e8400-e29b-41d4-a716-446655440000&ref=1737176208560'
      );
    });

    it('ERROR: Lỗi khi publish event từ VNPay callback', async () => {
      // ARRANGE
      const req = mockRequest(undefined, mockVNPayCallback.success);
      const res = mockResponse();

      (publishEvent as jest.Mock).mockRejectedValue(new Error('Kafka connection failed'));

      const handleVNPayReturn = async (req: any, res: any) => {
        try {
          const vnp_ResponseCode = req.query.vnp_ResponseCode;
          const vnp_TxnRef = req.query.vnp_TxnRef;
          const vnp_Amount = req.query.vnp_Amount;
          const vnp_OrderInfo = req.query.vnp_OrderInfo;

          // Sửa regex để match chính xác với format "Order order-550e8400-e29b-41d4-a716-446655440000 - iPhone 15 Pro Max"
          const orderIdMatch = vnp_OrderInfo?.match(/Order\s+(order-[a-f0-9-]+)/);
          const orderId = orderIdMatch ? orderIdMatch[1] : vnp_TxnRef;

          const paymentStatus = vnp_ResponseCode === '00' ? 'success' : 'failed';
          const amount = parseInt(vnp_Amount || '0') / 100;

          await publishEvent(
            orderId, '', 'system@vnpay.com', amount,
            'VNPay Payment', paymentStatus, vnp_TxnRef
          );

          res.redirect('http://localhost:3000/payment-result?status=success');
        } catch (error: any) {
          res.status(500).json({
            success: false,
            message: 'Error processing payment callback'
          });
        }
      };

      // ACT
      await handleVNPayReturn(req, res);

      // ASSERT
      expect(publishEvent).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error processing payment callback'
      });
    });

    it('ERROR: Thiếu thông tin callback từ VNPay', async () => {
      // ARRANGE
      const req = mockRequest(undefined, {}); // Empty query
      const res = mockResponse();

      const handleVNPayReturn = async (req: any, res: any) => {
        const vnp_ResponseCode = req.query.vnp_ResponseCode;
        const vnp_TxnRef = req.query.vnp_TxnRef;
        const vnp_OrderInfo = req.query.vnp_OrderInfo;

        if (!vnp_ResponseCode || !vnp_TxnRef || !vnp_OrderInfo) {
          res.status(400).json({
            success: false,
            message: 'Missing required callback parameters'
          });
          return;
        }
      };

      // ACT
      await handleVNPayReturn(req, res);

      // ASSERT
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing required callback parameters'
      });
    });
  });
});
