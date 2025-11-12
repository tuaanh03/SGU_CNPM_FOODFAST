// Test setup file - chạy trước mỗi test
// Thiết lập môi trường test và mock các dependencies

// Mock Prisma client
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    }
  }
}));

// Mock Redis client
jest.mock('../src/lib/redis', () => ({
  __esModule: true,
  default: {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  }
}));

// Mock Kafka utils
jest.mock('../src/utils/kafka', () => ({
  publishEvent: jest.fn(),
  publishOrderExpirationEvent: jest.fn(),
}));

// Mock Redis Session Manager
jest.mock('../src/utils/redisSessionManager', () => ({
  createOrderSession: jest.fn(),
  checkOrderSession: jest.fn(),
  getOrderSession: jest.fn(),
  deleteOrderSession: jest.fn(),
  getSessionTTL: jest.fn(),
}));

// Mock fetch cho API calls
global.fetch = jest.fn();

// Cleanup after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise((resolve) => setTimeout(resolve, 500));
});

