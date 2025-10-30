/**
 * Integration Test Suite: Order Creation Workflow
 *
 * Test Scenarios:
 * 1. Successful order creation with valid items
 * 2. Order creation with multiple items
 * 3. Order validation failures (invalid products, insufficient stock, etc.)
 * 4. Kafka event publishing verification
 * 5. Redis session creation verification
 */

import request from 'supertest';
import express, { Express } from 'express';
import prisma from '../../src/lib/prisma';
import redisClient from '../../src/lib/redis';
import { publishEvent } from '../../src/utils/kafka';
import { createOrder, getOrderStatus } from '../../src/controllers/order';
import {
  mockUser,
  mockProductResponse,
  mockProductResponse2,
  mockValidOrderRequest
} from '../fixtures/mockData';

// Mock modules
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../src/utils/kafka', () => ({
  publishEvent: jest.fn(),
  publishOrderExpirationEvent: jest.fn(),
}));

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

// Mock fetch for Product Service calls
global.fetch = jest.fn();

describe('Integration Test Suite: Order Creation Workflow', () => {
  let app: Express;

  beforeAll(() => {
    // Setup Express app for testing
    app = express();
    app.use(express.json());

    // Mock auth middleware - inject user
    app.use((req: any, res, next) => {
      req.user = mockUser;
      next();
    });

    // Mount routes
    app.post('/order/create', createOrder);
    app.get('/order/status/:orderId', getOrderStatus);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup
    jest.restoreAllMocks();
  });

  describe('Test Case 1: Successful Order Creation with Single Item', () => {
    it('should create order, publish Kafka event, and create Redis session', async () => {
      // Arrange: Mock Product Service response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductResponse,
      });

      // Mock Prisma order creation
      const mockCreatedOrder = {
        id: 'order-uuid-123',
        userId: mockUser.id,
        totalPrice: 12000000,
        deliveryAddress: '123 Test Street',
        contactPhone: '0901234567',
        note: 'Test order',
        status: 'pending',
        expirationTime: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-uuid-1',
            orderId: 'order-uuid-123',
            productId: mockProductResponse.data.id,
            productName: mockProductResponse.data.name,
            productPrice: mockProductResponse.data.price,
            quantity: 1,
            createdAt: new Date(),
          },
        ],
      };

      (prisma.order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');

      // Act: Send request to create order
      const response = await request(app)
        .post('/order/create')
        .send(mockValidOrderRequest)
        .expect(201);

      // Assert: Response validation
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('PENDING');
      expect(response.body.data.orderId).toBe('order-uuid-123');
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.totalPrice).toBe(12000000);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.session.expiresAt).toBeDefined();
      expect(response.body.data.session.durationMinutes).toBe(15);

      // Assert: Product Service was called
      expect(global.fetch).toHaveBeenCalledWith(
        `http://api-gateway:3000/api/products/${mockProductResponse.data.id}`
      );

      // Assert: Prisma create was called with correct data
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          totalPrice: 12000000,
          deliveryAddress: '123 Test Street',
          contactPhone: '0901234567',
          note: 'Test order',
          status: 'pending',
          expirationTime: expect.any(Date),
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({
                productId: mockProductResponse.data.id,
                productName: mockProductResponse.data.name,
                productPrice: mockProductResponse.data.price,
                quantity: 1,
              }),
            ]),
          },
        }),
        include: {
          items: true,
        },
      });

      // Assert: Redis session was created with TTL
      expect(redisClient.setex).toHaveBeenCalledWith(
        `order:session:order-uuid-123`,
        15 * 60, // 15 minutes in seconds
        expect.stringContaining('"orderId":"order-uuid-123"')
      );

      // Assert: Kafka event was published
      expect(publishEvent).toHaveBeenCalledWith(
        expect.stringContaining('"orderId":"order-uuid-123"')
      );

      // Verify Kafka payload structure
      const kafkaPayload = JSON.parse((publishEvent as jest.Mock).mock.calls[0][0]);
      expect(kafkaPayload).toMatchObject({
        orderId: 'order-uuid-123',
        userId: mockUser.id,
        items: expect.any(Array),
        totalPrice: 12000000,
        expiresAt: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });

  describe('Test Case 2: Order Creation with Multiple Items', () => {
    it('should calculate total price correctly for multiple items', async () => {
      // Arrange: Mock multiple product responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProductResponse2,
        });

      const multipleItemsRequest = {
        items: [
          { productId: mockProductResponse.data.id, quantity: 2 },
          { productId: mockProductResponse2.data.id, quantity: 1 },
        ],
        deliveryAddress: '456 Another Street',
        contactPhone: '0907654321',
        note: 'Multiple items order',
      };

      const expectedTotalPrice =
        mockProductResponse.data.price * 2 +
        mockProductResponse2.data.price;

      const mockCreatedOrder = {
        id: 'order-uuid-456',
        userId: mockUser.id,
        totalPrice: expectedTotalPrice,
        deliveryAddress: '456 Another Street',
        contactPhone: '0907654321',
        note: 'Multiple items order',
        status: 'pending',
        expirationTime: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-uuid-1',
            orderId: 'order-uuid-456',
            productId: mockProductResponse.data.id,
            productName: mockProductResponse.data.name,
            productPrice: mockProductResponse.data.price,
            quantity: 2,
            createdAt: new Date(),
          },
          {
            id: 'item-uuid-2',
            orderId: 'order-uuid-456',
            productId: mockProductResponse2.data.id,
            productName: mockProductResponse2.data.name,
            productPrice: mockProductResponse2.data.price,
            quantity: 1,
            createdAt: new Date(),
          },
        ],
      };

      (prisma.order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');

      // Act
      const response = await request(app)
        .post('/order/create')
        .send(multipleItemsRequest)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPrice).toBe(expectedTotalPrice);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.items[0].quantity).toBe(2);
      expect(response.body.data.items[1].quantity).toBe(1);

      // Verify Product Service was called twice
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify Kafka event contains all items
      const kafkaPayload = JSON.parse((publishEvent as jest.Mock).mock.calls[0][0]);
      expect(kafkaPayload.items).toHaveLength(2);
      expect(kafkaPayload.totalPrice).toBe(expectedTotalPrice);
    });
  });

  describe('Test Case 3: Order Validation - Product Not Found', () => {
    it('should return 400 error when product does not exist', async () => {
      // Arrange: Mock Product Service to return 404
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Act
      const response = await request(app)
        .post('/order/create')
        .send(mockValidOrderRequest)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('không tồn tại');

      // Verify order was NOT created
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(publishEvent).not.toHaveBeenCalled();
      expect(redisClient.setex).not.toHaveBeenCalled();
    });
  });

  describe('Test Case 4: Order Validation - Product Not Available', () => {
    it('should return 400 error when product is not available', async () => {
      // Arrange: Mock unavailable product
      const unavailableProduct = {
        data: {
          ...mockProductResponse.data,
          isAvailable: false,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => unavailableProduct,
      });

      // Act
      const response = await request(app)
        .post('/order/create')
        .send(mockValidOrderRequest)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('không còn kinh doanh');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe('Test Case 5: Order Validation - Invalid Quantity', () => {
    it('should return 400 error when quantity is zero or negative', async () => {
      // Arrange
      const invalidRequest = {
        ...mockValidOrderRequest,
        items: [
          { productId: mockProductResponse.data.id, quantity: 0 },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductResponse,
      });

      // Act
      const response = await request(app)
        .post('/order/create')
        .send(invalidRequest)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('lớn hơn 0');
    });
  });

  describe('Test Case 6: Order Validation - Missing Required Fields', () => {
    it('should return 400 error when items array is empty', async () => {
      // Arrange
      const invalidRequest = {
        ...mockValidOrderRequest,
        items: [],
      };

      // Act
      const response = await request(app)
        .post('/order/create')
        .send(invalidRequest)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it('should return 400 error when deliveryAddress is missing', async () => {
      // Arrange
      const invalidRequest = {
        ...mockValidOrderRequest,
        deliveryAddress: undefined,
      };

      // Act
      const response = await request(app)
        .post('/order/create')
        .send(invalidRequest)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });
  });

  describe('Test Case 7: Get Order Status', () => {
    it('should retrieve order status successfully', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-uuid-789',
        userId: mockUser.id,
        status: 'pending',
        totalPrice: 12000000,
        deliveryAddress: '123 Test Street',
        contactPhone: '0901234567',
        note: 'Test order',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-uuid-1',
            productId: mockProductResponse.data.id,
            productName: mockProductResponse.data.name,
            productPrice: mockProductResponse.data.price,
            quantity: 1,
          },
        ],
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      // Act
      const response = await request(app)
        .get('/order/status/order-uuid-789')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.orderId).toBe('order-uuid-789');
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.totalPrice).toBe(12000000);

      // Verify Prisma was called with correct parameters
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'order-uuid-789',
          userId: mockUser.id,
        },
        include: {
          items: true,
        },
      });
    });

    it('should return 404 when order not found', async () => {
      // Arrange
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/order/status/nonexistent-order')
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Không tìm thấy');
    });
  });

  describe('Test Case 8: Kafka Event Payload Validation', () => {
    it('should publish complete and valid Kafka event payload', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductResponse,
      });

      const mockCreatedOrder = {
        id: 'order-kafka-test',
        userId: mockUser.id,
        totalPrice: 12000000,
        deliveryAddress: '123 Test Street',
        contactPhone: '0901234567',
        note: 'Kafka test',
        status: 'pending',
        expirationTime: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            orderId: 'order-kafka-test',
            productId: mockProductResponse.data.id,
            productName: mockProductResponse.data.name,
            productPrice: mockProductResponse.data.price,
            quantity: 1,
            createdAt: new Date(),
          },
        ],
      };

      (prisma.order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);
      (redisClient.setex as jest.Mock).mockResolvedValue('OK');

      // Act
      await request(app)
        .post('/order/create')
        .send(mockValidOrderRequest)
        .expect(201);

      // Assert: Verify Kafka event was published
      expect(publishEvent).toHaveBeenCalledTimes(1);

      // Parse and validate the Kafka payload
      const kafkaPayloadString = (publishEvent as jest.Mock).mock.calls[0][0];
      const kafkaPayload = JSON.parse(kafkaPayloadString);

      // Validate required fields
      expect(kafkaPayload).toHaveProperty('orderId');
      expect(kafkaPayload).toHaveProperty('userId');
      expect(kafkaPayload).toHaveProperty('items');
      expect(kafkaPayload).toHaveProperty('totalPrice');
      expect(kafkaPayload).toHaveProperty('expiresAt');
      expect(kafkaPayload).toHaveProperty('timestamp');

      // Validate data types
      expect(typeof kafkaPayload.orderId).toBe('string');
      expect(typeof kafkaPayload.userId).toBe('string');
      expect(Array.isArray(kafkaPayload.items)).toBe(true);
      expect(typeof kafkaPayload.totalPrice).toBe('number');

      // Validate items structure
      expect(kafkaPayload.items[0]).toHaveProperty('productId');
      expect(kafkaPayload.items[0]).toHaveProperty('productName');
      expect(kafkaPayload.items[0]).toHaveProperty('productPrice');
      expect(kafkaPayload.items[0]).toHaveProperty('quantity');
      expect(kafkaPayload.items[0]).toHaveProperty('subtotal');

      // Validate timestamp is valid ISO8601
      expect(() => new Date(kafkaPayload.timestamp)).not.toThrow();
      expect(() => new Date(kafkaPayload.expiresAt)).not.toThrow();
    });
  });
});

