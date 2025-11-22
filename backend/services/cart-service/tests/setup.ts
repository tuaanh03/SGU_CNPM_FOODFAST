// Test setup for cart-service integration tests

process.env.NODE_ENV = 'test';

import redisClient, { connectRedis } from '../src/config/redis';

// Connect to Redis once before tests if not already connected
beforeAll(async () => {
  try {
    // in redis v4 createClient doesn't auto-connect; call connect if not ready
    if (!redisClient.isOpen) {
      await connectRedis();
    }
  } catch (err) {
    console.error('Failed to connect to Redis in test setup:', err);
    throw err;
  }
});

// Provide global cleanup between tests if needed
afterEach(async () => {
  // small delay to allow operations to settle
  await new Promise((r) => setTimeout(r, 10));
});

// Quit Redis after all tests
afterAll(async () => {
  try {
    if (redisClient && redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    console.warn('Error quitting Redis in tests:', err);
  }
  // small delay for jest to exit gracefully
  await new Promise((resolve) => setTimeout(resolve, 50));
});

