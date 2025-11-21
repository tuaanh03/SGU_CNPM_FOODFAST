// This test mocks kafkajs so we can assert that publishProductSyncEvent
// sends the expected messages without requiring a real Kafka broker.

describe('Product Kafka Integration - Tests (mocked broker)', () => {
  it('should publish CREATED/UPDATED/DELETED events via producer.send', async () => {
    // Reset module registry to ensure fresh imports
    jest.resetModules();

    // Capture array for messages sent by the fake producer
    const captured: any[] = [];

    // Mock kafkajs before importing the kafka util
    jest.doMock('kafkajs', () => {
      class MockProducer {
        async connect() { /* no-op */ }
        async send({ topic, messages }: any) {
          for (const m of messages) {
            try {
              const parsed = JSON.parse(m.value);
              captured.push({ topic, message: parsed });
            } catch (e) {
              captured.push({ topic, message: m.value });
            }
          }
        }
      }
      class MockKafka {
        constructor() {}
        producer() { return new MockProducer(); }
        consumer() { return { connect: async () => {}, subscribe: async () => {}, run: async () => {}, disconnect: async () => {} } }
      }
      return { Kafka: MockKafka, Partitioners: { DefaultPartitioner: () => {} } };
    });

    // Ensure kafka is enabled for this test so the module initializes producer
    const prevDisable = process.env.DISABLE_KAFKA;
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.DISABLE_KAFKA = 'false';
    process.env.NODE_ENV = 'development';

    // Import the function after mocking
    const { publishProductSyncEvent } = require('../../src/utils/kafka');

    // CREATED
    const productA = { id: 'kafka-prod-1', name: 'P1', price: 100, storeId: 's1', categoryId: 'c1', isAvailable: true };
    await publishProductSyncEvent('CREATED', productA);
    await new Promise((r) => setTimeout(r, 20));
    const created = captured.find(c => c.message?.data?.id === productA.id);
    expect(created).toBeDefined();
    expect(created.message.eventType).toBe('CREATED');

    // UPDATED
    const productB = { id: 'kafka-prod-2', name: 'P2', price: 200, storeId: 's1', isAvailable: true };
    await publishProductSyncEvent('UPDATED', productB);
    await new Promise((r) => setTimeout(r, 20));
    const updated = captured.find(c => c.message?.data?.id === productB.id);
    expect(updated).toBeDefined();
    expect(updated.message.eventType).toBe('UPDATED');

    // DELETED
    const productC = { id: 'kafka-prod-3' };
    await publishProductSyncEvent('DELETED', productC);
    await new Promise((r) => setTimeout(r, 20));
    const deleted = captured.find(c => c.message?.data?.id === productC.id);
    expect(deleted).toBeDefined();
    expect(deleted.message.eventType).toBe('DELETED');

    // Restore env
    process.env.DISABLE_KAFKA = prevDisable;
    process.env.NODE_ENV = prevNodeEnv;
  });
});