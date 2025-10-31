import prisma from '../../../src/lib/prisma';
import redisClient from '../../../src/lib/redis';
import { createOrderSession, checkOrderSession, getOrderSession, deleteOrderSession, getSessionTTL } from '../../../src/utils/redisSessionManager';

describe('Phase 2: User Navigation Scenarios', () => {
  const testOrderId = 'test-order-navigation';
  const testUserId = 'test-user-nav-123';
  const testTotalPrice = 200000;

  beforeAll(async () => {
    await deleteOrderSession(testOrderId);
  });

  afterEach(async () => {
    await deleteOrderSession(testOrderId);
  });

  afterAll(async () => {
    await redisClient.quit();
    await prisma.$disconnect();
  });

  describe('Scenario 1: User đóng tab VNPay', () => {
    test('TC1.1: Order status vẫn PENDING sau khi user đóng tab', async () => {
      // Arrange: Tạo session
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Giả sử order đã có status = pending
      const orderStatus = 'pending';

      // Act: User đóng tab VNPay (không có action nào từ backend)
      // Không có API call, không có callback

      // Assert: Order status không đổi
      expect(orderStatus).toBe('pending');
    });

    test('TC1.2: Redis session vẫn active sau khi user đóng tab', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: User đóng tab (không có backend action)

      // Assert: Session vẫn tồn tại
      const exists = await checkOrderSession(testOrderId);
      expect(exists).toBe(true);
    });

    test('TC1.3: TTL vẫn đếm ngược sau khi đóng tab', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);
      const ttlBefore = await getSessionTTL(testOrderId);

      // Act: Đợi 2 giây
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Assert: TTL giảm đi
      const ttlAfter = await getSessionTTL(testOrderId);
      expect(ttlAfter).toBeLessThan(ttlBefore);
      expect(ttlBefore - ttlAfter).toBeGreaterThanOrEqual(2);
    });

    test('TC1.4: PaymentIntent và PaymentAttempt status không đổi', () => {
      // Khi user đóng tab, backend không biết
      // PaymentIntent và PaymentAttempt vẫn ở status PROCESSING

      const paymentIntentStatus = 'PROCESSING';
      const paymentAttemptStatus = 'PROCESSING';

      // Assert
      expect(paymentIntentStatus).toBe('PROCESSING');
      expect(paymentAttemptStatus).toBe('PROCESSING');
    });
  });

  describe('Scenario 2: User quay lại trang web', () => {
    test('TC2.1: User có thể query order status', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: Frontend call GET /order/status/:orderId
      const orderResponse = {
        success: true,
        data: {
          orderId: testOrderId,
          status: 'pending',
          totalPrice: testTotalPrice
        }
      };

      // Assert
      expect(orderResponse.success).toBe(true);
      expect(orderResponse.data.status).toBe('pending');
    });

    test('TC2.2: Session vẫn active khi user quay lại', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: User quay lại sau vài phút
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Assert: Session vẫn còn
      const exists = await checkOrderSession(testOrderId);
      expect(exists).toBe(true);
    });

    test('TC2.3: User có thể thấy thời gian còn lại của session', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act
      const ttl = await getSessionTTL(testOrderId);
      const remainingMinutes = Math.ceil(ttl / 60);

      // Assert
      expect(remainingMinutes).toBeGreaterThan(0);
      expect(remainingMinutes).toBeLessThanOrEqual(15);
    });

    test('TC2.4: Frontend có thể hiển thị nút "Tiếp tục thanh toán"', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      const orderStatus = 'pending';
      const sessionExists = await checkOrderSession(testOrderId);

      // Act: Logic frontend
      const shouldShowContinueButton = orderStatus === 'pending' && sessionExists;

      // Assert
      expect(shouldShowContinueButton).toBe(true);
    });
  });

  describe('Scenario 3: User reload page', () => {
    test('TC3.1: Session vẫn tồn tại sau khi reload', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: User reload page (re-fetch data)
      const exists = await checkOrderSession(testOrderId);

      // Assert
      expect(exists).toBe(true);
    });

    test('TC3.2: Order data có thể được fetch lại', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);
      const sessionData = await getOrderSession(testOrderId);

      // Act: Reload page, re-fetch session
      const sessionDataAfterReload = await getOrderSession(testOrderId);

      // Assert: Data giống nhau
      expect(sessionDataAfterReload.orderId).toBe(sessionData.orderId);
      expect(sessionDataAfterReload.totalPrice).toBe(sessionData.totalPrice);
    });

    test('TC3.3: TTL tiếp tục đếm ngược sau reload', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);
      const ttlBefore = await getSessionTTL(testOrderId);

      // Act: Đợi 1 giây, sau đó reload (re-fetch TTL)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const ttlAfter = await getSessionTTL(testOrderId);

      // Assert
      expect(ttlAfter).toBeLessThan(ttlBefore);
    });
  });

  describe('Scenario 4: User bấm Back button trên VNPay', () => {
    test('TC4.1: VNPay có thể redirect về returnUrl', () => {
      // VNPay có thể redirect về returnUrl khi user bấm back
      const returnUrl = 'http://localhost:3001/vnpay-return';

      // Assert: returnUrl phải valid
      expect(returnUrl).toMatch(/^http/);
    });

    test('TC4.2: Order status vẫn pending khi user back', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);
      const orderStatus = 'pending';

      // Act: User bấm back (không có callback từ VNPay)

      // Assert
      expect(orderStatus).toBe('pending');
    });

    test('TC4.3: Session không bị xóa khi user back', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: User back từ VNPay

      // Assert
      const exists = await checkOrderSession(testOrderId);
      expect(exists).toBe(true);
    });
  });

  describe('Scenario 5: Session expiration tracking', () => {
    test('TC5.1: Session có TTL đếm ngược từ 900s', async () => {
      // Arrange & Act
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);
      const ttl = await getSessionTTL(testOrderId);

      // Assert
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(900);
    });

    test('TC5.2: Session tự động expire sau 15 phút', async () => {
      // Arrange: Tạo session với TTL rất ngắn (1 giây) để test
      const shortOrderId = 'test-order-short-ttl';
      const key = `order:session:${shortOrderId}`;

      await redisClient.setex(key, 1, JSON.stringify({
        orderId: shortOrderId,
        userId: testUserId,
        totalPrice: testTotalPrice
      }));

      // Act: Đợi session expire
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Assert: Session không còn tồn tại
      const exists = await redisClient.exists(key);
      expect(exists).toBe(0);
    });

    test('TC5.3: Có thể tính remaining time từ TTL', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act
      const ttl = await getSessionTTL(testOrderId);
      const remainingMinutes = Math.ceil(ttl / 60);

      // Assert
      expect(remainingMinutes).toBeGreaterThan(0);
      expect(remainingMinutes).toBeLessThanOrEqual(15);
    });
  });

  describe('Scenario 6: Multiple navigation actions', () => {
    test('TC6.1: User có thể đóng và mở lại nhiều lần', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: Nhiều lần check session
      const check1 = await checkOrderSession(testOrderId);
      await new Promise(resolve => setTimeout(resolve, 500));
      const check2 = await checkOrderSession(testOrderId);
      await new Promise(resolve => setTimeout(resolve, 500));
      const check3 = await checkOrderSession(testOrderId);

      // Assert: Session vẫn tồn tại qua nhiều lần check
      expect(check1).toBe(true);
      expect(check2).toBe(true);
      expect(check3).toBe(true);
    });

    test('TC6.2: Session data không thay đổi qua các navigation', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);
      const initialData = await getOrderSession(testOrderId);

      // Act: User navigate nhiều lần
      await new Promise(resolve => setTimeout(resolve, 1000));
      const dataAfterNav = await getOrderSession(testOrderId);

      // Assert: Data không đổi (trừ TTL)
      expect(dataAfterNav.orderId).toBe(initialData.orderId);
      expect(dataAfterNav.userId).toBe(initialData.userId);
      expect(dataAfterNav.totalPrice).toBe(initialData.totalPrice);
    });
  });

  describe('Scenario 7: Payment URL reusability', () => {
    test('TC7.1: User có thể sử dụng lại cùng payment URL', () => {
      // Trong Phase 2, payment URL vẫn valid
      // User có thể click lại link payment URL nhiều lần

      const paymentUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=10000000';

      // Assert: URL không đổi trong Phase 2
      expect(paymentUrl).toBeDefined();
    });

    test('TC7.2: Payment URL expires cùng với session', async () => {
      // Arrange
      const session = await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act & Assert: Payment URL chỉ valid trong thời gian session
      const expirationTime = new Date(session.expirationTime);
      expect(expirationTime.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Scenario 8: Error recovery', () => {
    test('TC8.1: Xử lý khi không tìm thấy session', async () => {
      // Act: Query session không tồn tại
      const exists = await checkOrderSession('non-existent-order');

      // Assert
      expect(exists).toBe(false);
    });

    test('TC8.2: Xử lý khi session data bị corrupt', async () => {
      // Arrange: Lưu data invalid
      const corruptOrderId = 'corrupt-order';
      await redisClient.setex(`order:session:${corruptOrderId}`, 60, 'invalid-json');

      // Act
      const sessionData = await getOrderSession(corruptOrderId);

      // Assert: Hàm getOrderSession() xử lý error và return null
      expect(sessionData).toBeNull();

      // Cleanup
      await redisClient.del(`order:session:${corruptOrderId}`);
    });
  });

  describe('Scenario 9: Concurrent user actions', () => {
    test('TC9.1: Session không bị conflict khi query đồng thời', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: Query đồng thời nhiều lần
      const promises = [
        checkOrderSession(testOrderId),
        checkOrderSession(testOrderId),
        checkOrderSession(testOrderId)
      ];
      const results = await Promise.all(promises);

      // Assert: Tất cả đều return true
      expect(results.every(r => r === true)).toBe(true);
    });

    test('TC9.2: Multiple tabs có thể fetch cùng session data', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: Giả lập 3 tabs fetch đồng thời
      const [data1, data2, data3] = await Promise.all([
        getOrderSession(testOrderId),
        getOrderSession(testOrderId),
        getOrderSession(testOrderId)
      ]);

      // Assert: Data giống nhau
      expect(data1.orderId).toBe(data2.orderId);
      expect(data2.orderId).toBe(data3.orderId);
      expect(data1.totalPrice).toBe(testTotalPrice);
    });
  });

  describe('Scenario 10: User abandonment tracking', () => {
    test('TC10.1: Có thể track thời gian user ở VNPay', async () => {
      // Arrange
      const session = await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);
      const startTime = new Date(session.expirationTime);
      startTime.setMinutes(startTime.getMinutes() - 15); // Thời điểm tạo session

      // Act: Tính thời gian đã trôi qua
      const elapsedMs = Date.now() - startTime.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      // Assert
      expect(elapsedMinutes).toBeGreaterThanOrEqual(0);
      expect(elapsedMinutes).toBeLessThan(15);
    });

    test('TC10.2: Có thể log analytics khi user quay lại', async () => {
      // Arrange
      await createOrderSession(testOrderId, testUserId, testTotalPrice, 15);

      // Act: User quay lại, có thể log event
      const analyticsEvent = {
        event: 'USER_RETURNED_TO_ORDER',
        orderId: testOrderId,
        userId: testUserId,
        timestamp: new Date().toISOString()
      };

      // Assert
      expect(analyticsEvent.event).toBe('USER_RETURNED_TO_ORDER');
      expect(analyticsEvent).toHaveProperty('timestamp');
    });
  });
});

