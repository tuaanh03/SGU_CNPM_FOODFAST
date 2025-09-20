// Mock setup cho Payment Service tests
import { mockVNPayResponse, mockEnvVars } from '../fixtures/mockData';

// Mock global fetch
global.fetch = jest.fn();

// Mock environment variables
process.env = { ...process.env, ...mockEnvVars };

// Mock kafka producer và consumer
export const mockProducer = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
};

export const mockConsumer = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  run: jest.fn().mockResolvedValue(undefined),
};

// Mock kafkajs
jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: jest.fn().mockReturnValue(mockProducer),
    consumer: jest.fn().mockReturnValue(mockConsumer),
  })),
  Partitioners: {
    DefaultPartitioner: jest.fn(),
  },
}));

// Mock crypto module
export const mockCrypto = {
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('mocked-hash-signature')
    })
  })
};

jest.mock('crypto', () => mockCrypto);

// Reset all mocks function
export const resetAllMocks = () => {
  jest.clearAllMocks();

  // Reset producer mocks
  mockProducer.connect.mockResolvedValue(undefined);
  mockProducer.send.mockResolvedValue(undefined);
  mockProducer.disconnect.mockResolvedValue(undefined);

  // Reset consumer mocks
  mockConsumer.connect.mockResolvedValue(undefined);
  mockConsumer.subscribe.mockResolvedValue(undefined);
  mockConsumer.run.mockResolvedValue(undefined);
  mockConsumer.disconnect.mockResolvedValue(undefined);

  // Reset crypto mock
  mockCrypto.createHmac.mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('mocked-hash-signature')
    })
  });
};

// Helper để setup mock cho processPayment success
export const setupProcessPaymentMock = (success: boolean, response?: any) => {
  const mockProcessPayment = require('../../src/utils/vnpay').processPayment as jest.Mock;

  if (success) {
    mockProcessPayment.mockResolvedValue(response || mockVNPayResponse);
  } else {
    mockProcessPayment.mockResolvedValue({
      success: false,
      error: 'Payment processing failed'
    });
  }
};

// Helper để setup mock cho publishEvent
export const setupPublishEventMock = (success: boolean) => {
  const mockPublishEvent = require('../../src/utils/kafka').publishEvent as jest.Mock;

  if (success) {
    mockPublishEvent.mockResolvedValue(true);
  } else {
    mockPublishEvent.mockRejectedValue(new Error('Kafka connection failed'));
  }
};
