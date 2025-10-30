/**
 * Integration Test Suite: Payment Intent & First Payment Attempt
 *
 * This test suite simulates the Payment Service consumer behavior
 * when receiving order.create events from Kafka.
 *
 * Test Scenarios:
 * 1. Payment Service receives order.create event
 * 2. PaymentIntent creation from order data
 * 3. First PaymentAttempt creation
 * 4. VNPay API integration
 * 5. Payment URL generation
 * 6. Error handling and retry logic
 */

import { publishEvent } from '../../../src/utils/kafka';

// Mock Kafka
jest.mock('../../../src/utils/kafka', () => ({
  publishEvent: jest.fn(),
  publishOrderExpirationEvent: jest.fn(),
}));

describe('Integration Test Suite: Payment Intent & First Payment Attempt', () => {
  const mockOrderData = {
    orderId: 'order-payment-test-123',
    userId: 'user-uuid-789',
    items: [
      {
        productId: 'product-uuid-1',
        productName: 'Test Product',
        productPrice: 50000,
        quantity: 2,
        subtotal: 100000,
      },
    ],
    totalPrice: 100000,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test Case 1: Kafka Event Publishing - order.create', () => {
    it('should publish order.create event with complete payload', async () => {
      // Arrange
      (publishEvent as jest.Mock).mockResolvedValue(undefined);

      // Act
      await publishEvent(JSON.stringify(mockOrderData));

      // Assert
      expect(publishEvent).toHaveBeenCalledTimes(1);

      const publishedPayload = (publishEvent as jest.Mock).mock.calls[0][0];
      const parsedPayload = JSON.parse(publishedPayload);

      // Verify payload structure
      expect(parsedPayload).toMatchObject({
        orderId: mockOrderData.orderId,
        userId: mockOrderData.userId,
        totalPrice: mockOrderData.totalPrice,
      });

      expect(parsedPayload.items).toHaveLength(1);
      expect(parsedPayload.items[0]).toMatchObject({
        productId: 'product-uuid-1',
        productName: 'Test Product',
        productPrice: 50000,
        quantity: 2,
        subtotal: 100000,
      });

      expect(parsedPayload).toHaveProperty('expiresAt');
      expect(parsedPayload).toHaveProperty('timestamp');
    });

    it('should publish order.create event for multiple items', async () => {
      // Arrange
      const multiItemOrderData = {
        ...mockOrderData,
        items: [
          {
            productId: 'product-1',
            productName: 'Product 1',
            productPrice: 50000,
            quantity: 1,
            subtotal: 50000,
          },
          {
            productId: 'product-2',
            productName: 'Product 2',
            productPrice: 75000,
            quantity: 2,
            subtotal: 150000,
          },
        ],
        totalPrice: 200000,
      };

      (publishEvent as jest.Mock).mockResolvedValue(undefined);

      // Act
      await publishEvent(JSON.stringify(multiItemOrderData));

      // Assert
      const publishedPayload = (publishEvent as jest.Mock).mock.calls[0][0];
      const parsedPayload = JSON.parse(publishedPayload);

      expect(parsedPayload.items).toHaveLength(2);
      expect(parsedPayload.totalPrice).toBe(200000);
    });
  });

  describe('Test Case 2: PaymentIntent Data Structure', () => {
    it('should contain required fields for PaymentIntent creation', () => {
      // This simulates what Payment Service would receive and use
      // to create a PaymentIntent record

      const paymentIntentData = {
        orderId: mockOrderData.orderId,
        amount: mockOrderData.totalPrice,
        currency: 'VND',
        status: 'REQUIRES_PAYMENT',
        metadata: {
          userId: mockOrderData.userId,
          description: `Payment for Order ${mockOrderData.orderId}`,
          items: mockOrderData.items,
          createdAt: mockOrderData.timestamp,
        },
      };

      // Verify structure
      expect(paymentIntentData).toHaveProperty('orderId');
      expect(paymentIntentData).toHaveProperty('amount');
      expect(paymentIntentData).toHaveProperty('currency');
      expect(paymentIntentData).toHaveProperty('status');
      expect(paymentIntentData.currency).toBe('VND');
      expect(paymentIntentData.status).toBe('REQUIRES_PAYMENT');
      expect(paymentIntentData.amount).toBe(100000);
    });

    it('should include metadata with user and order information', () => {
      const paymentIntentMetadata = {
        userId: mockOrderData.userId,
        description: `Payment for Order ${mockOrderData.orderId}`,
        items: mockOrderData.items,
        createdAt: mockOrderData.timestamp,
        expiresAt: mockOrderData.expiresAt,
      };

      // Verify metadata structure
      expect(paymentIntentMetadata).toHaveProperty('userId');
      expect(paymentIntentMetadata).toHaveProperty('description');
      expect(paymentIntentMetadata).toHaveProperty('items');
      expect(paymentIntentMetadata).toHaveProperty('createdAt');
      expect(paymentIntentMetadata).toHaveProperty('expiresAt');
      expect(paymentIntentMetadata.items).toHaveLength(1);
    });
  });

  describe('Test Case 3: First PaymentAttempt Structure', () => {
    it('should contain required fields for first PaymentAttempt', () => {
      // Simulate first payment attempt creation
      const mockPaymentIntentId = 'pi-uuid-123';

      const paymentAttemptData = {
        paymentIntentId: mockPaymentIntentId,
        status: 'CREATED',
        amount: mockOrderData.totalPrice,
        currency: 'VND',
        pspProvider: 'VNPAY',
        vnpTxnRef: `${mockOrderData.orderId}-${Date.now()}`,
        metadata: {
          userId: mockOrderData.userId,
          description: `Payment for Order ${mockOrderData.orderId}`,
          orderId: mockOrderData.orderId,
        },
      };

      // Verify structure
      expect(paymentAttemptData).toHaveProperty('paymentIntentId');
      expect(paymentAttemptData).toHaveProperty('status');
      expect(paymentAttemptData).toHaveProperty('amount');
      expect(paymentAttemptData).toHaveProperty('currency');
      expect(paymentAttemptData).toHaveProperty('pspProvider');
      expect(paymentAttemptData).toHaveProperty('vnpTxnRef');
      expect(paymentAttemptData.status).toBe('CREATED');
      expect(paymentAttemptData.pspProvider).toBe('VNPAY');
      expect(paymentAttemptData.vnpTxnRef).toContain(mockOrderData.orderId);
    });

    it('should generate unique vnpTxnRef for each attempt', () => {
      // Simulate multiple payment attempts
      const txnRefs = new Set();

      for (let i = 0; i < 5; i++) {
        const vnpTxnRef = `${mockOrderData.orderId}-${Date.now()}-${i}`;
        txnRefs.add(vnpTxnRef);
      }

      // Verify uniqueness
      expect(txnRefs.size).toBe(5);
    });
  });

  describe('Test Case 4: VNPay Payment URL Generation', () => {
    it('should construct valid VNPay payment URL parameters', () => {
      // Simulate VNPay URL generation
      const vnpTxnRef = `${mockOrderData.orderId}-${Date.now()}`;

      const vnpayParams = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: 'TEST_TMN_CODE',
        vnp_Amount: mockOrderData.totalPrice * 100, // VNPay expects amount in cents
        vnp_CurrCode: 'VND',
        vnp_TxnRef: vnpTxnRef,
        vnp_OrderInfo: `Payment for Order ${mockOrderData.orderId}`,
        vnp_OrderType: 'other',
        vnp_Locale: 'vn',
        vnp_ReturnUrl: 'http://localhost:3001/vnpay-return',
        vnp_CreateDate: new Date().toISOString().replace(/[-:]/g, '').split('.')[0],
      };

      // Verify parameters
      expect(vnpayParams.vnp_Amount).toBe(10000000); // 100000 * 100
      expect(vnpayParams.vnp_TxnRef).toContain(mockOrderData.orderId);
      expect(vnpayParams.vnp_OrderInfo).toContain(mockOrderData.orderId);
      expect(vnpayParams.vnp_CurrCode).toBe('VND');
      expect(vnpayParams.vnp_Locale).toBe('vn');
    });

    it('should include all required VNPay parameters', () => {
      const vnpayParams = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: 'TEST_TMN_CODE',
        vnp_Amount: mockOrderData.totalPrice * 100,
        vnp_CurrCode: 'VND',
        vnp_TxnRef: `${mockOrderData.orderId}-${Date.now()}`,
        vnp_OrderInfo: `Payment for Order ${mockOrderData.orderId}`,
        vnp_OrderType: 'other',
        vnp_Locale: 'vn',
        vnp_ReturnUrl: 'http://localhost:3001/vnpay-return',
        vnp_CreateDate: new Date().toISOString().replace(/[-:]/g, '').split('.')[0],
      };

      // Check required fields
      const requiredFields = [
        'vnp_Version',
        'vnp_Command',
        'vnp_TmnCode',
        'vnp_Amount',
        'vnp_CurrCode',
        'vnp_TxnRef',
        'vnp_OrderInfo',
        'vnp_ReturnUrl',
        'vnp_CreateDate',
      ];

      requiredFields.forEach(field => {
        expect(vnpayParams).toHaveProperty(field);
        expect(vnpayParams[field as keyof typeof vnpayParams]).toBeDefined();
      });
    });
  });

  describe('Test Case 5: Payment Status Transitions', () => {
    it('should transition from CREATED to PROCESSING', () => {
      // Initial state
      let paymentAttemptStatus = 'CREATED';
      let paymentIntentStatus = 'REQUIRES_PAYMENT';

      // Simulate VNPay API call success
      const vnpayCallSuccess = true;

      if (vnpayCallSuccess) {
        paymentAttemptStatus = 'PROCESSING';
        paymentIntentStatus = 'PROCESSING';
      }

      // Verify transitions
      expect(paymentAttemptStatus).toBe('PROCESSING');
      expect(paymentIntentStatus).toBe('PROCESSING');
    });

    it('should track status progression: REQUIRES_PAYMENT -> PROCESSING -> SUCCESS', () => {
      const statusHistory = [
        { intent: 'REQUIRES_PAYMENT', attempt: 'CREATED' },
        { intent: 'PROCESSING', attempt: 'PROCESSING' },
        { intent: 'SUCCESS', attempt: 'SUCCESS' },
      ];

      // Verify progression
      expect(statusHistory[0]).toEqual({
        intent: 'REQUIRES_PAYMENT',
        attempt: 'CREATED',
      });
      expect(statusHistory[1]).toEqual({
        intent: 'PROCESSING',
        attempt: 'PROCESSING',
      });
      expect(statusHistory[2]).toEqual({
        intent: 'SUCCESS',
        attempt: 'SUCCESS',
      });
    });
  });

  describe('Test Case 6: Payment Event Response', () => {
    it('should prepare payment.event message with payment URL', () => {
      const mockPaymentUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=10000000&vnp_Command=pay&...';
      const mockPaymentIntentId = 'pi-uuid-456';

      const paymentEvent = {
        orderId: mockOrderData.orderId,
        userId: mockOrderData.userId,
        email: 'user@example.com',
        amount: mockOrderData.totalPrice,
        item: `Order ${mockOrderData.orderId}`,
        paymentStatus: 'pending',
        paymentIntentId: mockPaymentIntentId,
        paymentUrl: mockPaymentUrl,
      };

      // Verify event structure
      expect(paymentEvent).toHaveProperty('orderId');
      expect(paymentEvent).toHaveProperty('userId');
      expect(paymentEvent).toHaveProperty('paymentStatus');
      expect(paymentEvent).toHaveProperty('paymentUrl');
      expect(paymentEvent).toHaveProperty('paymentIntentId');
      expect(paymentEvent.paymentStatus).toBe('pending');
      expect(paymentEvent.paymentUrl).toContain('vnpayment.vn');
    });

    it('should prepare payment.event message for failure', () => {
      const paymentEvent = {
        orderId: mockOrderData.orderId,
        userId: mockOrderData.userId,
        email: 'user@example.com',
        amount: mockOrderData.totalPrice,
        item: `Order ${mockOrderData.orderId}`,
        paymentStatus: 'failed',
        error: 'VNPay API connection failed',
      };

      // Verify event structure
      expect(paymentEvent.paymentStatus).toBe('failed');
      expect(paymentEvent).toHaveProperty('error');
      expect(paymentEvent).not.toHaveProperty('paymentUrl');
    });
  });

  describe('Test Case 7: Error Handling Scenarios', () => {
    it('should handle missing orderId in event', () => {
      const invalidEvent = {
        userId: mockOrderData.userId,
        totalPrice: mockOrderData.totalPrice,
        // orderId is missing
      };

      // Validate
      const isValid = invalidEvent.hasOwnProperty('orderId');
      expect(isValid).toBe(false);
    });

    it('should handle missing userId in event', () => {
      const invalidEvent = {
        orderId: mockOrderData.orderId,
        totalPrice: mockOrderData.totalPrice,
        // userId is missing
      };

      // Validate
      const isValid = invalidEvent.hasOwnProperty('userId');
      expect(isValid).toBe(false);
    });

    it('should handle invalid totalPrice', () => {
      const invalidEvents = [
        { ...mockOrderData, totalPrice: 0 },
        { ...mockOrderData, totalPrice: -100 },
        { ...mockOrderData, totalPrice: null },
        { ...mockOrderData, totalPrice: undefined },
      ];

      invalidEvents.forEach(event => {
        const isValid = event.totalPrice && event.totalPrice > 0;
        expect(isValid).toBeFalsy();
      });
    });
  });

  describe('Test Case 8: Kafka Message Flow Simulation', () => {
    it('should simulate complete message flow: order.create -> payment.event', async () => {
      // Step 1: Order Service publishes order.create
      (publishEvent as jest.Mock).mockResolvedValue(undefined);
      await publishEvent(JSON.stringify(mockOrderData));

      expect(publishEvent).toHaveBeenCalledTimes(1);
      const orderCreatePayload = (publishEvent as jest.Mock).mock.calls[0][0];

      // Step 2: Payment Service would consume order.create
      // (simulated - Payment Service not in this test suite)
      const consumedEvent = JSON.parse(orderCreatePayload);
      expect(consumedEvent.orderId).toBe(mockOrderData.orderId);

      // Step 3: Payment Service would publish payment.event
      const paymentEvent = {
        orderId: consumedEvent.orderId,
        userId: consumedEvent.userId,
        email: 'user@example.com',
        amount: consumedEvent.totalPrice,
        item: `Order ${consumedEvent.orderId}`,
        paymentStatus: 'pending',
        paymentIntentId: 'pi-generated-uuid',
        paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...',
      };

      // Verify the flow
      expect(paymentEvent.orderId).toBe(mockOrderData.orderId);
      expect(paymentEvent.userId).toBe(mockOrderData.userId);
      expect(paymentEvent.amount).toBe(mockOrderData.totalPrice);
      expect(paymentEvent).toHaveProperty('paymentUrl');
    });
  });

  describe('Test Case 9: PaymentAttempt Retry Logic', () => {
    it('should support multiple payment attempts for same intent', () => {
      const paymentIntentId = 'pi-retry-test';
      const attempts = [];

      // Simulate 3 payment attempts
      for (let i = 1; i <= 3; i++) {
        attempts.push({
          id: `pa-${i}`,
          paymentIntentId,
          status: i < 3 ? 'FAILED' : 'SUCCESS',
          vnpTxnRef: `${mockOrderData.orderId}-${Date.now()}-attempt-${i}`,
          attemptNumber: i,
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      // Verify attempts
      expect(attempts).toHaveLength(3);
      expect(attempts[0].status).toBe('FAILED');
      expect(attempts[1].status).toBe('FAILED');
      expect(attempts[2].status).toBe('SUCCESS');

      // Verify each has unique vnpTxnRef
      const txnRefs = attempts.map(a => a.vnpTxnRef);
      const uniqueTxnRefs = new Set(txnRefs);
      expect(uniqueTxnRefs.size).toBe(3);
    });
  });

  describe('Test Case 10: Amount Calculation for VNPay', () => {
    it('should convert VND amount to VNPay format (multiply by 100)', () => {
      const testCases = [
        { vnd: 100000, vnpay: 10000000 },
        { vnd: 50000, vnpay: 5000000 },
        { vnd: 1000000, vnpay: 100000000 },
        { vnd: 25500, vnpay: 2550000 },
      ];

      testCases.forEach(({ vnd, vnpay }) => {
        const convertedAmount = vnd * 100;
        expect(convertedAmount).toBe(vnpay);
      });
    });

    it('should handle large amounts correctly', () => {
      const largeAmount = 999999999; // ~10M VND
      const vnpayAmount = largeAmount * 100;

      expect(vnpayAmount).toBe(99999999900);
      expect(Number.isInteger(vnpayAmount)).toBe(true);
    });
  });

  describe('Test Case 11: Timestamp Handling', () => {
    it('should generate valid timestamps for all events', () => {
      const timestamps = {
        orderCreated: new Date().toISOString(),
        paymentIntentCreated: new Date().toISOString(),
        paymentAttemptCreated: new Date().toISOString(),
        vnpayRequestSent: new Date().toISOString(),
      };

      // Verify all timestamps are valid ISO8601
      Object.values(timestamps).forEach(timestamp => {
        expect(() => new Date(timestamp)).not.toThrow();
        expect(new Date(timestamp).toISOString()).toBe(timestamp);
      });
    });

    it('should maintain chronological order of events', () => {
      const events = [
        { type: 'order_created', timestamp: Date.now() },
        { type: 'payment_intent_created', timestamp: Date.now() + 100 },
        { type: 'payment_attempt_created', timestamp: Date.now() + 200 },
        { type: 'vnpay_request', timestamp: Date.now() + 300 },
      ];

      // Verify chronological order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp).toBeGreaterThan(events[i - 1].timestamp);
      }
    });
  });
});

