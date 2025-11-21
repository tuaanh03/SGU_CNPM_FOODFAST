# Testing Guide - Food Delivery Microservices

**Ngày cập nhật:** 19/11/2025  
**Testing Framework:** Jest  
**Test Types:** Unit Tests, Integration Tests, E2E Tests  
**Coverage Target:** > 80%

---

## 📋 Tổng quan Testing Strategy

### Testing Pyramid

```
        /\
       /  \
      / E2E \       < 10% - End-to-End Tests
     /______\
    /        \
   /Integration\   < 30% - Integration Tests
  /____________\
 /              \
/   Unit Tests   \  < 60% - Unit Tests
/________________\
```

### Test Types

**Unit Tests:**
- Test từng function/class riêng lẻ
- Mock tất cả dependencies
- Chạy nhanh, isolated

**Integration Tests:**
- Test tích hợp giữa các components
- Test database operations
- Test API endpoints
- Test Kafka events

**E2E Tests:**
- Test toàn bộ user flow
- Test qua API Gateway
- Test cross-service workflows

---

## 🎯 Testing cho từng Service

### 1. User Service Testing

#### Unit Tests

**File: `tests/unit/auth.test.ts`**

```typescript
import { hashPassword, comparePassword, generateToken, verifyToken } from '../../src/utils/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock bcryptjs
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('Auth Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'Test@123456';
      const hashedPassword = '$2a$10$abcdefghijklmnopqrstuvwxyz';
      
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);
      
      const result = await hashPassword(password);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should throw error if hashing fails', async () => {
      const password = 'Test@123456';
      mockedBcrypt.hash.mockRejectedValue(new Error('Hashing failed') as never);
      
      await expect(hashPassword(password)).rejects.toThrow('Hashing failed');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      const password = 'Test@123456';
      const hash = '$2a$10$abcdefghijklmnopqrstuvwxyz';
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      
      const result = await comparePassword(password, hash);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      const password = 'WrongPassword';
      const hash = '$2a$10$abcdefghijklmnopqrstuvwxyz';
      
      mockedBcrypt.compare.mockResolvedValue(false as never);
      
      const result = await comparePassword(password, hash);
      
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with user data', () => {
      const userData = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'CUSTOMER',
      };
      const token = 'jwt.token.here';
      
      mockedJwt.sign.mockReturnValue(token as never);
      
      const result = generateToken(userData);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        userData,
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = 'valid.jwt.token';
      const decoded = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'CUSTOMER',
      };
      
      mockedJwt.verify.mockReturnValue(decoded as never);
      
      const result = verifyToken(token);
      
      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(result).toEqual(decoded);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid.token';
      
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      expect(() => verifyToken(token)).toThrow('Invalid token');
    });
  });
});
```

**File: `tests/unit/validation.test.ts`**

```typescript
import { validateEmail, validatePassword, validatePhone } from '../../src/utils/validation';

describe('Validation - Unit Tests', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
      ];
      
      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user name@example.com',
      ];
      
      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const validPasswords = [
        'Test@123456',
        'MyP@ssw0rd!',
        'Str0ng#Pass',
      ];
      
      validPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        '12345678',        // No letters
        'password',        // No numbers/special chars
        'Pass123',         // Too short
        'ALLUPPERCASE123', // No lowercase
      ];
      
      invalidPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });
  });

  describe('validatePhone', () => {
    it('should accept valid Vietnamese phone numbers', () => {
      const validPhones = [
        '0901234567',
        '+84901234567',
        '84901234567',
      ];
      
      validPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '123',
        'notaphone',
        '12345678901234567890',
      ];
      
      invalidPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(false);
      });
    });
  });
});
```

#### Integration Tests

**File: `tests/integration/auth.api.test.ts`**

```typescript
import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/lib/prisma';

describe('Auth API - Integration Tests', () => {
  beforeAll(async () => {
    // Clean up test database
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /auth/customer/register', () => {
    it('should register a new customer', async () => {
      const userData = {
        email: 'newcustomer@test.com',
        password: 'Test@123456',
        name: 'Test Customer',
        phone: '0901234567',
      };

      const response = await request(app)
        .post('/auth/customer/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toMatchObject({
        email: userData.email,
        name: userData.name,
        role: 'CUSTOMER',
      });
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'Test@123456',
        name: 'Test User',
        phone: '0901234567',
      };

      // First registration
      await request(app)
        .post('/auth/customer/register')
        .send(userData)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/auth/customer/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Test@123456',
        name: 'Test User',
        phone: '0901234567',
      };

      const response = await request(app)
        .post('/auth/customer/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject weak password', async () => {
      const userData = {
        email: 'weakpass@test.com',
        password: '12345',
        name: 'Test User',
        phone: '0901234567',
      };

      const response = await request(app)
        .post('/auth/customer/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('password');
    });
  });

  describe('POST /auth/customer/login', () => {
    const testUser = {
      email: 'logintest@test.com',
      password: 'Test@123456',
      name: 'Login Test',
      phone: '0901234567',
    };

    beforeAll(async () => {
      // Create test user
      await request(app)
        .post('/auth/customer/register')
        .send(testUser);
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/customer/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject wrong password', async () => {
      const response = await request(app)
        .post('/auth/customer/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject non-existent email', async () => {
      const response = await request(app)
        .post('/auth/customer/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Test@123456',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/profile (Protected)', () => {
    let authToken: string;

    beforeAll(async () => {
      // Register and login to get token
      const userData = {
        email: 'profiletest@test.com',
        password: 'Test@123456',
        name: 'Profile Test',
        phone: '0901234567',
      };

      const loginRes = await request(app)
        .post('/auth/customer/register')
        .send(userData);

      authToken = loginRes.body.data.token;
    });

    it('should get profile with valid token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('email', 'profiletest@test.com');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
```

---

### 2. Product Service Testing

#### Unit Tests

**File: `tests/unit/product.service.test.ts`**

```typescript
import { calculateDiscountedPrice, isProductAvailable, validateProductData } from '../../src/services/product.service';

describe('Product Service - Unit Tests', () => {
  describe('calculateDiscountedPrice', () => {
    it('should calculate discounted price correctly', () => {
      expect(calculateDiscountedPrice(100000, 10)).toBe(90000);
      expect(calculateDiscountedPrice(50000, 20)).toBe(40000);
      expect(calculateDiscountedPrice(200000, 50)).toBe(100000);
    });

    it('should return original price if discount is 0', () => {
      expect(calculateDiscountedPrice(100000, 0)).toBe(100000);
    });

    it('should handle decimal discounts', () => {
      expect(calculateDiscountedPrice(100000, 15.5)).toBe(84500);
    });
  });

  describe('isProductAvailable', () => {
    it('should return true for available product', () => {
      const product = {
        isAvailable: true,
        stock: 10,
      };
      expect(isProductAvailable(product)).toBe(true);
    });

    it('should return false for unavailable product', () => {
      const product = {
        isAvailable: false,
        stock: 10,
      };
      expect(isProductAvailable(product)).toBe(false);
    });

    it('should return false for out-of-stock product', () => {
      const product = {
        isAvailable: true,
        stock: 0,
      };
      expect(isProductAvailable(product)).toBe(false);
    });
  });

  describe('validateProductData', () => {
    it('should validate correct product data', () => {
      const productData = {
        name: 'Test Product',
        price: 50000,
        description: 'Test description',
        storeId: 'store-123',
        categoryId: 'category-456',
      };

      expect(() => validateProductData(productData)).not.toThrow();
    });

    it('should reject negative price', () => {
      const productData = {
        name: 'Test Product',
        price: -50000,
        description: 'Test description',
        storeId: 'store-123',
      };

      expect(() => validateProductData(productData)).toThrow('Price must be positive');
    });

    it('should reject empty name', () => {
      const productData = {
        name: '',
        price: 50000,
        description: 'Test description',
        storeId: 'store-123',
      };

      expect(() => validateProductData(productData)).toThrow('Name is required');
    });
  });
});
```

#### Integration Tests

**File: `tests/integration/product.api.test.ts`**

```typescript
import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/lib/prisma';

describe('Product API - Integration Tests', () => {
  let adminToken: string;
  let storeId: string;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    // Setup: Create admin user, store, and category
    // (Implementation depends on your test setup)
  });

  afterAll(async () => {
    // Cleanup
    await prisma.product.deleteMany({ where: { storeId } });
    await prisma.$disconnect();
  });

  describe('POST /products (Create Product)', () => {
    it('should create a new product', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test description',
        price: 50000,
        imageUrl: 'https://example.com/image.jpg',
        storeId,
        categoryId,
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product).toMatchObject({
        name: productData.name,
        price: productData.price,
        storeId,
      });

      productId = response.body.data.product.id;
    });

    it('should reject product creation without authentication', async () => {
      const productData = {
        name: 'Test Product',
        price: 50000,
        storeId,
      };

      await request(app)
        .post('/products')
        .send(productData)
        .expect(401);
    });

    it('should reject product with invalid price', async () => {
      const productData = {
        name: 'Test Product',
        price: -1000,
        storeId,
      };

      const response = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /products', () => {
    it('should get all products', async () => {
      const response = await request(app)
        .get('/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter products by storeId', async () => {
      const response = await request(app)
        .get(`/products?storeId=${storeId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((p: any) => p.storeId === storeId)).toBe(true);
    });

    it('should filter products by categoryId', async () => {
      const response = await request(app)
        .get(`/products?categoryId=${categoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((p: any) => p.categoryId === categoryId)).toBe(true);
    });
  });

  describe('PUT /products/:id (Update Product)', () => {
    it('should update product', async () => {
      const updateData = {
        name: 'Updated Product Name',
        price: 75000,
      };

      const response = await request(app)
        .put(`/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product.name).toBe(updateData.name);
      expect(response.body.data.product.price).toBe(updateData.price);
    });

    it('should reject update for non-existent product', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      await request(app)
        .put('/products/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should delete product', async () => {
      const response = await request(app)
        .delete(`/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify product is deleted
      const getResponse = await request(app)
        .get(`/products/${productId}`)
        .expect(404);
    });
  });
});
```

#### Kafka Integration Tests

**File: `tests/integration/product.kafka.test.ts`**

```typescript
import { Kafka } from 'kafkajs';
import { publishProductSyncEvent } from '../../src/utils/kafka';
import prisma from '../../src/lib/prisma';

describe('Product Kafka Integration - Tests', () => {
  let kafka: Kafka;
  let consumer: any;
  let receivedMessages: any[] = [];

  beforeAll(async () => {
    // Setup Kafka consumer for testing
    kafka = new Kafka({
      clientId: 'product-service-test',
      brokers: ['localhost:9092'],
    });

    consumer = kafka.consumer({ groupId: 'test-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'product.sync', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }: any) => {
        receivedMessages.push(JSON.parse(message.value.toString()));
      },
    });
  });

  afterAll(async () => {
    await consumer.disconnect();
  });

  it('should publish CREATED event when product is created', async () => {
    const productData = {
      id: 'test-product-123',
      name: 'Test Product',
      price: 50000,
      storeId: 'test-store',
      categoryId: 'test-category',
      isAvailable: true,
    };

    await publishProductSyncEvent('CREATED', productData);

    // Wait for message
    await new Promise(resolve => setTimeout(resolve, 2000));

    const message = receivedMessages.find(m => m.data.id === productData.id);
    expect(message).toBeDefined();
    expect(message.eventType).toBe('CREATED');
    expect(message.data).toMatchObject(productData);
  });

  it('should publish UPDATED event when product is updated', async () => {
    const productData = {
      id: 'test-product-456',
      name: 'Updated Product',
      price: 75000,
      storeId: 'test-store',
      isAvailable: true,
    };

    await publishProductSyncEvent('UPDATED', productData);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const message = receivedMessages.find(m => m.data.id === productData.id);
    expect(message).toBeDefined();
    expect(message.eventType).toBe('UPDATED');
  });

  it('should publish DELETED event when product is deleted', async () => {
    const productData = {
      id: 'test-product-789',
    };

    await publishProductSyncEvent('DELETED', productData);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const message = receivedMessages.find(m => m.data.id === productData.id);
    expect(message).toBeDefined();
    expect(message.eventType).toBe('DELETED');
  });
});
```

---

### 3. Order Service Testing

#### Unit Tests

**File: `tests/unit/order.validation.test.ts`**

```typescript
import { validateOrderItems, calculateOrderTotal, validateDeliveryAddress } from '../../src/utils/orderValidation';

describe('Order Validation - Unit Tests', () => {
  describe('validateOrderItems', () => {
    it('should validate correct order items', () => {
      const items = [
        { productId: 'p1', quantity: 2, price: 50000 },
        { productId: 'p2', quantity: 1, price: 30000 },
      ];

      expect(() => validateOrderItems(items)).not.toThrow();
    });

    it('should reject empty items array', () => {
      const items: any[] = [];
      expect(() => validateOrderItems(items)).toThrow('Order must have at least one item');
    });

    it('should reject items with zero quantity', () => {
      const items = [
        { productId: 'p1', quantity: 0, price: 50000 },
      ];

      expect(() => validateOrderItems(items)).toThrow('Quantity must be greater than 0');
    });

    it('should reject items with negative price', () => {
      const items = [
        { productId: 'p1', quantity: 1, price: -50000 },
      ];

      expect(() => validateOrderItems(items)).toThrow('Price must be positive');
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total correctly', () => {
      const items = [
        { productId: 'p1', quantity: 2, price: 50000 },
        { productId: 'p2', quantity: 1, price: 30000 },
      ];

      const total = calculateOrderTotal(items);
      expect(total).toBe(130000); // (2*50000) + (1*30000)
    });

    it('should handle single item', () => {
      const items = [
        { productId: 'p1', quantity: 3, price: 20000 },
      ];

      expect(calculateOrderTotal(items)).toBe(60000);
    });

    it('should return 0 for empty array', () => {
      expect(calculateOrderTotal([])).toBe(0);
    });
  });

  describe('validateDeliveryAddress', () => {
    it('should accept valid address', () => {
      const address = '227 Nguyễn Văn Cừ, Quận 5, TP.HCM';
      expect(() => validateDeliveryAddress(address)).not.toThrow();
    });

    it('should reject empty address', () => {
      expect(() => validateDeliveryAddress('')).toThrow('Address is required');
    });

    it('should reject too short address', () => {
      expect(() => validateDeliveryAddress('ABC')).toThrow('Address too short');
    });
  });
});
```

#### Integration Tests

**File: `tests/integration/order.workflow.test.ts`**

```typescript
import request from 'supertest';
import app from '../../src/server';
import prisma from '../../src/lib/prisma';
import { redisClient } from '../../src/config/redis';

describe('Order Workflow - Integration Tests', () => {
  let customerToken: string;
  let storeId: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    // Setup test data
  });

  afterAll(async () => {
    await redisClient.quit();
    await prisma.$disconnect();
  });

  describe('Complete Order Flow', () => {
    it('should complete full order workflow', async () => {
      // Step 1: Add product to cart
      const cartResponse = await request(app)
        .post('/cart/add')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          restaurantId: storeId,
          productId,
          quantity: 2,
        })
        .expect(200);

      expect(cartResponse.body.success).toBe(true);

      // Step 2: Create order from cart
      const orderResponse = await request(app)
        .post('/order/create-from-cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          restaurantId: storeId,
          deliveryAddress: '227 Nguyễn Văn Cừ, Quận 5, TP.HCM',
          contactPhone: '0901234567',
        })
        .expect(201);

      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.data).toHaveProperty('orderId');
      expect(orderResponse.body.data).toHaveProperty('paymentUrl');

      orderId = orderResponse.body.data.orderId;

      // Step 3: Check order status
      const statusResponse = await request(app)
        .get(`/order/status/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.status).toBe('PENDING');

      // Step 4: Verify Redis session created
      const session = await redisClient.get(`order:session:${orderId}`);
      expect(session).not.toBeNull();
    });

    it('should handle order expiration', async () => {
      // Create order
      const orderResponse = await request(app)
        .post('/order/create-from-cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          restaurantId: storeId,
          deliveryAddress: '227 Nguyễn Văn Cừ, Quận 5, TP.HCM',
          contactPhone: '0901234567',
        });

      const orderId = orderResponse.body.data.orderId;

      // Set short TTL for testing
      await redisClient.expire(`order:session:${orderId}`, 2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check order status should be EXPIRED
      const statusResponse = await request(app)
        .get(`/order/status/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(statusResponse.body.data.status).toBe('EXPIRED');
    });

    it('should handle payment success', async () => {
      // This would be tested with Kafka events
      // Simulate payment success event from Payment Service
      
      const paymentEvent = {
        orderId,
        paymentIntentId: 'pi_123',
        paymentStatus: 'success',
        amount: 100000,
      };

      // Publish to Kafka (or use mock)
      // ... 

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check order status updated to CONFIRMED
      const statusResponse = await request(app)
        .get(`/order/status/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(statusResponse.body.data.status).toBe('CONFIRMED');
    });
  });
});
```

---

### 4. Payment Service Testing

#### Unit Tests

**File: `tests/unit/payment.service.test.ts`**

```typescript
import { generateVNPayURL, verifyVNPaySignature, parseVNPayResponse } from '../../src/utils/vnpay';
import crypto from 'crypto';

describe('Payment Service - VNPay - Unit Tests', () => {
  const mockConfig = {
    vnpTmnCode: 'TEST_TMN',
    vnpHashSecret: 'TEST_SECRET',
    vnpUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    vnpReturnUrl: 'http://localhost:3000/payment-result',
  };

  describe('generateVNPayURL', () => {
    it('should generate valid VNPay payment URL', () => {
      const params = {
        amount: 100000,
        orderId: 'order-123',
        orderInfo: 'Payment for order-123',
        ipAddr: '127.0.0.1',
      };

      const url = generateVNPayURL(params, mockConfig);

      expect(url).toContain(mockConfig.vnpUrl);
      expect(url).toContain('vnp_TmnCode=TEST_TMN');
      expect(url).toContain('vnp_Amount=10000000'); // 100000 * 100
      expect(url).toContain('vnp_SecureHash=');
    });

    it('should include all required parameters', () => {
      const params = {
        amount: 50000,
        orderId: 'order-456',
        orderInfo: 'Test payment',
        ipAddr: '192.168.1.1',
      };

      const url = generateVNPayURL(params, mockConfig);

      expect(url).toContain('vnp_Version=');
      expect(url).toContain('vnp_Command=');
      expect(url).toContain('vnp_TmnCode=');
      expect(url).toContain('vnp_Amount=');
      expect(url).toContain('vnp_CreateDate=');
      expect(url).toContain('vnp_CurrCode=');
      expect(url).toContain('vnp_OrderInfo=');
      expect(url).toContain('vnp_ReturnUrl=');
    });
  });

  describe('verifyVNPaySignature', () => {
    it('should verify valid signature', () => {
      const params = {
        vnp_Amount: '10000000',
        vnp_TmnCode: 'TEST_TMN',
        vnp_TxnRef: '123456',
        vnp_ResponseCode: '00',
      };

      // Generate signature
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key as keyof typeof params]}`)
        .join('&');
      
      const signature = crypto
        .createHmac('sha512', mockConfig.vnpHashSecret)
        .update(sortedParams)
        .digest('hex');

      const isValid = verifyVNPaySignature({ ...params, vnp_SecureHash: signature }, mockConfig);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const params = {
        vnp_Amount: '10000000',
        vnp_TmnCode: 'TEST_TMN',
        vnp_SecureHash: 'invalid_signature',
      };

      const isValid = verifyVNPaySignature(params, mockConfig);
      expect(isValid).toBe(false);
    });
  });

  describe('parseVNPayResponse', () => {
    it('should parse successful payment response', () => {
      const vnpayResponse = {
        vnp_ResponseCode: '00',
        vnp_TxnRef: '123456',
        vnp_Amount: '10000000',
        vnp_TransactionNo: 'VNP789',
        vnp_BankCode: 'NCB',
      };

      const parsed = parseVNPayResponse(vnpayResponse);

      expect(parsed.success).toBe(true);
      expect(parsed.transactionRef).toBe('123456');
      expect(parsed.amount).toBe(100000); // Divided by 100
      expect(parsed.transactionNo).toBe('VNP789');
    });

    it('should parse failed payment response', () => {
      const vnpayResponse = {
        vnp_ResponseCode: '24', // Payment failed
        vnp_TxnRef: '123456',
      };

      const parsed = parseVNPayResponse(vnpayResponse);

      expect(parsed.success).toBe(false);
      expect(parsed.errorCode).toBe('24');
    });
  });
});
```

---

### 5. Cart Service Testing

#### Integration Tests with Redis

**File: `tests/integration/cart.redis.test.ts`**

```typescript
import { redisClient } from '../../src/config/redis';
import { addToCart, getCart, updateCart, clearCart } from '../../src/services/cart.service';

describe('Cart Service - Redis Integration Tests', () => {
  const testUserId = 'test-user-123';
  const testRestaurantId = 'test-restaurant-456';

  beforeEach(async () => {
    // Clear test data
    await redisClient.del(`cart:${testUserId}:${testRestaurantId}`);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('addToCart', () => {
    it('should add item to cart in Redis', async () => {
      const item = {
        productId: 'product-1',
        name: 'Test Product',
        price: 50000,
        quantity: 2,
      };

      await addToCart(testUserId, testRestaurantId, item);

      // Verify in Redis
      const cartData = await redisClient.get(`cart:${testUserId}:${testRestaurantId}`);
      expect(cartData).not.toBeNull();

      const cart = JSON.parse(cartData!);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]).toMatchObject(item);
      expect(cart.totalPrice).toBe(100000); // 50000 * 2
    });

    it('should update quantity if product already in cart', async () => {
      const item = {
        productId: 'product-1',
        name: 'Test Product',
        price: 50000,
        quantity: 2,
      };

      // Add first time
      await addToCart(testUserId, testRestaurantId, item);

      // Add again
      await addToCart(testUserId, testRestaurantId, { ...item, quantity: 3 });

      const cartData = await redisClient.get(`cart:${testUserId}:${testRestaurantId}`);
      const cart = JSON.parse(cartData!);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(5); // 2 + 3
      expect(cart.totalPrice).toBe(250000); // 50000 * 5
    });
  });

  describe('getCart', () => {
    it('should retrieve cart from Redis', async () => {
      // Setup cart
      const item = {
        productId: 'product-1',
        name: 'Test Product',
        price: 50000,
        quantity: 2,
      };
      await addToCart(testUserId, testRestaurantId, item);

      // Get cart
      const cart = await getCart(testUserId, testRestaurantId);

      expect(cart).not.toBeNull();
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]).toMatchObject(item);
    });

    it('should return null for non-existent cart', async () => {
      const cart = await getCart('non-existent-user', 'non-existent-restaurant');
      expect(cart).toBeNull();
    });
  });

  describe('updateCart', () => {
    it('should update item quantity', async () => {
      // Setup cart
      const item = {
        productId: 'product-1',
        name: 'Test Product',
        price: 50000,
        quantity: 2,
      };
      await addToCart(testUserId, testRestaurantId, item);

      // Update quantity
      await updateCart(testUserId, testRestaurantId, 'product-1', 5);

      const cart = await getCart(testUserId, testRestaurantId);
      expect(cart.items[0].quantity).toBe(5);
      expect(cart.totalPrice).toBe(250000);
    });

    it('should remove item if quantity is 0', async () => {
      // Setup cart
      const item = {
        productId: 'product-1',
        name: 'Test Product',
        price: 50000,
        quantity: 2,
      };
      await addToCart(testUserId, testRestaurantId, item);

      // Update to 0
      await updateCart(testUserId, testRestaurantId, 'product-1', 0);

      const cart = await getCart(testUserId, testRestaurantId);
      expect(cart.items).toHaveLength(0);
      expect(cart.totalPrice).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      // Setup cart with multiple items
      await addToCart(testUserId, testRestaurantId, {
        productId: 'product-1',
        name: 'Product 1',
        price: 50000,
        quantity: 2,
      });
      await addToCart(testUserId, testRestaurantId, {
        productId: 'product-2',
        name: 'Product 2',
        price: 30000,
        quantity: 1,
      });

      // Clear cart
      await clearCart(testUserId, testRestaurantId);

      const cartData = await redisClient.get(`cart:${testUserId}:${testRestaurantId}`);
      expect(cartData).toBeNull();
    });
  });
});
```

---

## 🎯 Test Coverage Goals

### Coverage Targets

```bash
# Run tests with coverage
npm run test:coverage

# Expected output:
--------------------------------|---------|----------|---------|---------|
File                            | % Stmts | % Branch | % Funcs | % Lines |
--------------------------------|---------|----------|---------|---------|
All files                       |   82.5  |   78.3   |   85.1  |   82.8  |
  controllers/                  |   85.2  |   80.1   |   87.3  |   85.5  |
  services/                     |   88.7  |   82.5   |   90.2  |   89.1  |
  utils/                        |   75.3  |   70.8   |   78.5  |   75.9  |
  middleware/                   |   80.1  |   75.2   |   82.3  |   80.5  |
--------------------------------|---------|----------|---------|---------|
```

**Targets:**
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

---

## 🛠️ Testing Tools & Configuration

### Jest Configuration

**File: `jest.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Test Scripts

**File: `package.json`**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e"
  }
}
```

---

## 📚 Best Practices

### 1. Test Naming Convention

```typescript
describe('ServiceName - TestType', () => {
  describe('functionName', () => {
    it('should do something when condition', () => {
      // Test implementation
    });
  });
});
```

### 2. AAA Pattern (Arrange-Act-Assert)

```typescript
it('should calculate total price correctly', () => {
  // Arrange
  const items = [
    { price: 50000, quantity: 2 },
    { price: 30000, quantity: 1 },
  ];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(130000);
});
```

### 3. Test Isolation

```typescript
beforeEach(() => {
  // Reset state before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});
```

### 4. Mock External Dependencies

```typescript
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));
```

### 5. Async Test Handling

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

---

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

---

**Tài liệu liên quan:**
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - Tổng quan dự án
- [MONITORING_GUIDE.md](./MONITORING_GUIDE.md) - Hướng dẫn monitoring
- [K6_LOAD_TESTING_GUIDE.md](./K6_LOAD_TESTING_GUIDE.md) - Hướng dẫn load testing

