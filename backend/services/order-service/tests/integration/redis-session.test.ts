/**
 * Integration Test Suite: Redis Order Session Management
 *
 * Test Scenarios:
 * 1. Session creation with TTL
 * 2. Session retrieval
 * 3. Session expiration handling
 * 4. Session deletion on payment success
 * 5. TTL remaining check
 */

import redisClient from '../../src/lib/redis';
import {
  createOrderSession,
  checkOrderSession,
  getOrderSession,
  deleteOrderSession,
  getSessionTTL,
} from '../../src/utils/redisSessionManager';

// Mock Redis client
jest.mock('../../src/lib/redis', () => ({
  __esModule: true,
  default: {
    setex: jest.fn(),
    get: jest.fn(),
    exists: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
  },
}));

describe('Integration Test Suite: Redis Order Session Management', () => {
  const mockOrderId = 'order-session-test-123';
  const mockUserId = 'user-uuid-456';
  const mockTotalPrice = 50000;
  const sessionDurationMinutes = 15;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test Case 1: Create Order Session', () => {
    it('should create Redis session with correct TTL and data structure', async () => {
      // Arrange
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');

      // Act
      const result = await createOrderSession(
        mockOrderId,
        mockUserId,
        mockTotalPrice,
        sessionDurationMinutes
      );

      // Assert: Verify return value
      expect(result).toHaveProperty('expirationTime');
      expect(result).toHaveProperty('durationMinutes');
      expect(result.durationMinutes).toBe(sessionDurationMinutes);
      expect(result.expirationTime).toBeInstanceOf(Date);

      // Assert: Verify Redis setex was called with correct parameters
      expect(redisClient.setex).toHaveBeenCalledTimes(1);

      const [key, ttl, data] = (redisClient.setex as jest.Mock).mock.calls[0];

      // Verify key format
      expect(key).toBe(`order:session:${mockOrderId}`);

      // Verify TTL (15 minutes = 900 seconds)
      expect(ttl).toBe(sessionDurationMinutes * 60);

      // Verify data structure
      const sessionData = JSON.parse(data);
      expect(sessionData).toMatchObject({
        orderId: mockOrderId,
        userId: mockUserId,
        totalPrice: mockTotalPrice,
      });
      expect(sessionData).toHaveProperty('createdAt');
      expect(sessionData).toHaveProperty('expirationTime');

      // Verify timestamps are valid ISO strings
      expect(() => new Date(sessionData.createdAt)).not.toThrow();
      expect(() => new Date(sessionData.expirationTime)).not.toThrow();
    });

    it('should use default duration when not specified', async () => {
      // Arrange
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');
      process.env.ORDER_SESSION_DURATION_MINUTES = '15';

      // Act
      const result = await createOrderSession(
        mockOrderId,
        mockUserId,
        mockTotalPrice
      );

      // Assert
      expect(result.durationMinutes).toBe(15);

      const [, ttl] = (redisClient.setex as jest.Mock).mock.calls[0];
      expect(ttl).toBe(15 * 60);
    });

    it('should calculate expiration time correctly', async () => {
      // Arrange
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');
      const beforeCreateTime = Date.now();

      // Act
      const result = await createOrderSession(
        mockOrderId,
        mockUserId,
        mockTotalPrice,
        10 // 10 minutes
      );

      // Assert
      const afterCreateTime = Date.now();
      const expirationTimestamp = result.expirationTime.getTime();

      // Expiration should be approximately 10 minutes from now
      const expectedMin = beforeCreateTime + 10 * 60 * 1000;
      const expectedMax = afterCreateTime + 10 * 60 * 1000;

      expect(expirationTimestamp).toBeGreaterThanOrEqual(expectedMin);
      expect(expirationTimestamp).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('Test Case 2: Check Order Session Existence', () => {
    it('should return true when session exists', async () => {
      // Arrange
      (redisClient.exists as jest.Mock).mockResolvedValue(1);

      // Act
      const exists = await checkOrderSession(mockOrderId);

      // Assert
      expect(exists).toBe(true);
      expect(redisClient.exists).toHaveBeenCalledWith(`order:session:${mockOrderId}`);
    });

    it('should return false when session does not exist', async () => {
      // Arrange
      (redisClient.exists as jest.Mock).mockResolvedValue(0);

      // Act
      const exists = await checkOrderSession(mockOrderId);

      // Assert
      expect(exists).toBe(false);
    });
  });

  describe('Test Case 3: Get Order Session Data', () => {
    it('should retrieve and parse session data correctly', async () => {
      // Arrange
      const mockSessionData = {
        orderId: mockOrderId,
        userId: mockUserId,
        totalPrice: mockTotalPrice,
        createdAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };

      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockSessionData));

      // Act
      const sessionData = await getOrderSession(mockOrderId);

      // Assert
      expect(sessionData).toMatchObject(mockSessionData);
      expect(redisClient.get).toHaveBeenCalledWith(`order:session:${mockOrderId}`);
    });

    it('should return null when session does not exist', async () => {
      // Arrange
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      // Act
      const sessionData = await getOrderSession(mockOrderId);

      // Assert
      expect(sessionData).toBeNull();
    });

    it('should return null when session data is corrupted', async () => {
      // Arrange
      (redisClient.get as jest.Mock).mockResolvedValue('invalid-json{{{');

      // Act
      const sessionData = await getOrderSession(mockOrderId);

      // Assert
      expect(sessionData).toBeNull();
    });
  });

  describe('Test Case 4: Delete Order Session', () => {
    it('should delete session successfully', async () => {
      // Arrange
      (redisClient.del as jest.Mock).mockResolvedValue(1);

      // Act
      await deleteOrderSession(mockOrderId);

      // Assert
      expect(redisClient.del).toHaveBeenCalledWith(`order:session:${mockOrderId}`);
      expect(redisClient.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test Case 5: Get Session TTL', () => {
    it('should return remaining TTL in seconds', async () => {
      // Arrange
      const remainingTTL = 600; // 10 minutes remaining
      (redisClient.ttl as jest.Mock).mockResolvedValue(remainingTTL);

      // Act
      const ttl = await getSessionTTL(mockOrderId);

      // Assert
      expect(ttl).toBe(remainingTTL);
      expect(redisClient.ttl).toHaveBeenCalledWith(`order:session:${mockOrderId}`);
    });

    it('should return -2 when key does not exist', async () => {
      // Arrange
      (redisClient.ttl as jest.Mock).mockResolvedValue(-2);

      // Act
      const ttl = await getSessionTTL(mockOrderId);

      // Assert
      expect(ttl).toBe(-2);
    });

    it('should return -1 when key has no expiration', async () => {
      // Arrange
      (redisClient.ttl as jest.Mock).mockResolvedValue(-1);

      // Act
      const ttl = await getSessionTTL(mockOrderId);

      // Assert
      expect(ttl).toBe(-1);
    });
  });

  describe('Test Case 6: Session Lifecycle Integration', () => {
    it('should handle complete session lifecycle: create -> check -> get -> delete', async () => {
      // Setup mocks
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');
      (redisClient.exists as jest.Mock).mockResolvedValue(1);

      const mockSessionData = {
        orderId: mockOrderId,
        userId: mockUserId,
        totalPrice: mockTotalPrice,
        createdAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockSessionData));
      (redisClient.del as jest.Mock).mockResolvedValue(1);

      // 1. Create session
      const createResult = await createOrderSession(
        mockOrderId,
        mockUserId,
        mockTotalPrice,
        sessionDurationMinutes
      );
      expect(createResult.durationMinutes).toBe(sessionDurationMinutes);
      expect(redisClient.setex).toHaveBeenCalled();

      // 2. Check session exists
      const exists = await checkOrderSession(mockOrderId);
      expect(exists).toBe(true);
      expect(redisClient.exists).toHaveBeenCalled();

      // 3. Get session data
      const sessionData = await getOrderSession(mockOrderId);
      expect(sessionData).toMatchObject({
        orderId: mockOrderId,
        userId: mockUserId,
        totalPrice: mockTotalPrice,
      });
      expect(redisClient.get).toHaveBeenCalled();

      // 4. Delete session
      await deleteOrderSession(mockOrderId);
      expect(redisClient.del).toHaveBeenCalled();

      // Verify all operations were called in sequence
      expect(redisClient.setex).toHaveBeenCalledTimes(1);
      expect(redisClient.exists).toHaveBeenCalledTimes(1);
      expect(redisClient.get).toHaveBeenCalledTimes(1);
      expect(redisClient.del).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test Case 7: Session Expiration Scenarios', () => {
    it('should handle expired session (TTL = 0)', async () => {
      // Arrange
      (redisClient.ttl as jest.Mock).mockResolvedValue(0);
      (redisClient.exists as jest.Mock).mockResolvedValue(0);

      // Act
      const ttl = await getSessionTTL(mockOrderId);
      const exists = await checkOrderSession(mockOrderId);

      // Assert
      expect(ttl).toBe(0);
      expect(exists).toBe(false);
    });

    it('should track TTL decreasing over time (simulated)', async () => {
      // Simulate TTL at different time points
      const ttlValues = [900, 600, 300, 60, 0]; // 15min, 10min, 5min, 1min, expired

      for (const ttl of ttlValues) {
        (redisClient.ttl as jest.Mock).mockResolvedValueOnce(ttl);
        const remainingTTL = await getSessionTTL(mockOrderId);
        expect(remainingTTL).toBe(ttl);
      }
    });
  });

  describe('Test Case 8: Multiple Sessions', () => {
    it('should handle multiple order sessions independently', async () => {
      // Arrange
      const order1 = 'order-1';
      const order2 = 'order-2';
      const order3 = 'order-3';

      (redisClient.setex as jest.Mock).mockResolvedValue('OK');

      // Act: Create multiple sessions
      await createOrderSession(order1, 'user-1', 10000, 10);
      await createOrderSession(order2, 'user-2', 20000, 15);
      await createOrderSession(order3, 'user-3', 30000, 20);

      // Assert: Each session created with correct key
      expect(redisClient.setex).toHaveBeenCalledTimes(3);

      const calls = (redisClient.setex as jest.Mock).mock.calls;

      expect(calls[0][0]).toBe('order:session:order-1');
      expect(calls[0][1]).toBe(10 * 60);

      expect(calls[1][0]).toBe('order:session:order-2');
      expect(calls[1][1]).toBe(15 * 60);

      expect(calls[2][0]).toBe('order:session:order-3');
      expect(calls[2][1]).toBe(20 * 60);
    });
  });

  describe('Test Case 9: Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Arrange
      const redisError = new Error('Redis connection failed');
      (redisClient.setex as jest.Mock).mockRejectedValue(redisError);

      // Act & Assert
      await expect(
        createOrderSession(mockOrderId, mockUserId, mockTotalPrice)
      ).rejects.toThrow('Redis connection failed');
    });

    it('should handle get operation errors', async () => {
      // Arrange
      (redisClient.get as jest.Mock).mockRejectedValue(new Error('Get failed'));

      // Act & Assert
      await expect(getOrderSession(mockOrderId)).rejects.toThrow('Get failed');
    });
  });

  describe('Test Case 10: Custom Session Duration', () => {
    it('should support custom session durations', async () => {
      // Arrange
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');
      const customDurations = [5, 10, 15, 30, 60]; // minutes

      // Act & Assert
      for (const duration of customDurations) {
        await createOrderSession(mockOrderId, mockUserId, mockTotalPrice, duration);

        const lastCall = (redisClient.setex as jest.Mock).mock.calls.slice(-1)[0];
        const [, ttl] = lastCall;

        expect(ttl).toBe(duration * 60);
      }
    });
  });
});

