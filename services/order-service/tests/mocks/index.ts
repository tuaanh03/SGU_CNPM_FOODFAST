// Mock utilities - helper functions để setup mock cho tests
import { mockProductResponse } from '../fixtures/mockData';

// Mock cho Prisma client
export const mockPrismaOrder = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};

// Mock cho Kafka publishEvent
export const mockPublishEvent = jest.fn();

// Mock cho fetch API calls
export const setupFetchMock = (shouldSucceed = true, productData = mockProductResponse) => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  if (shouldSucceed) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => productData,
    } as Response);
  } else {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
  }
};

// Helper để reset tất cả mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  mockPrismaOrder.create.mockReset();
  mockPrismaOrder.findUnique.mockReset();
  mockPrismaOrder.update.mockReset();
  mockPublishEvent.mockReset();
};
