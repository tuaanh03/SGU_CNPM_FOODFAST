// Jest setup cho Payment Service
import { resetAllMocks } from './mocks';

// Setup mocks trước khi chạy tất cả tests
beforeAll(() => {
  resetAllMocks();
});

// Reset mocks sau mỗi test
afterEach(() => {
  resetAllMocks();
});

// Mock console để tránh log spam trong tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};
