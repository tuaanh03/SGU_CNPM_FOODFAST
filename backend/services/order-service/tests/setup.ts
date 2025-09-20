// Test setup file - chạy trước mỗi test
// Thiết lập môi trường test và mock các dependencies

// Mock Prisma client
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    }
  }
}));

// Mock Kafka utils
jest.mock('../src/utils/kafka', () => ({
  publishEvent: jest.fn()
}));

// Mock fetch cho API calls
global.fetch = jest.fn();
