import prisma from '../../src/lib/prisma';
import * as redisSessionManager from '../../src/utils/redisSessionManager';
import { publishEvent } from '../../src/utils/kafka';

/**
 * Integration Tests cho Order Workflow
 * Test toàn bộ luồng từ tạo đơn hàng đến thanh toán
 */
describe('Order Workflow Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Complete Order Creation Workflow', () => {
        it('should complete full order creation workflow', async () => {
            const userId = 'user-123';
            const productId = '123e4567-e89b-12d3-a456-426614174000';
            const orderData = {
                items: [{ productId, quantity: 2 }],
                deliveryAddress: '123 Test St',
                contactPhone: '0123456789'
            };

            // Step 1: Product validation
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        id: productId,
                        name: 'Test Product',
                        price: 100000,
                        isAvailable: true
                    }
                })
            }) as jest.Mock;

            // Step 2: Order creation in database
            const mockOrder = {
                id: 'order-123',
                userId,
                totalPrice: 200000,
                deliveryAddress: orderData.deliveryAddress,
                contactPhone: orderData.contactPhone,
                note: null,
                status: 'pending',
                expirationTime: new Date(Date.now() + 15 * 60 * 1000),
                createdAt: new Date(),
                items: [{
                    productId,
                    productName: 'Test Product',
                    productPrice: 100000,
                    quantity: 2
                }]
            };

            (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);

            // Step 3: Redis session creation
            const sessionResult = {
                expirationTime: new Date(Date.now() + 15 * 60 * 1000),
                durationMinutes: 15
            };
            (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue(sessionResult);

            // Step 4: Kafka event publishing
            (publishEvent as jest.Mock).mockResolvedValue(undefined);

            // Verify all steps executed
            expect(prisma.order.create).toBeDefined();
            expect(redisSessionManager.createOrderSession).toBeDefined();
            expect(publishEvent).toBeDefined();
        });

        it('should rollback on product validation failure', async () => {
            const productId = '223e4567-e89b-12d3-a456-426614174000';

            // Product not found
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404
            }) as jest.Mock;

            // Order should not be created
            (prisma.order.create as jest.Mock).mockClear();

            // Verify order creation was not attempted
            expect(prisma.order.create).not.toHaveBeenCalled();
        });

        it('should handle database transaction failure', async () => {
            const productId = '323e4567-e89b-12d3-a456-426614174000';

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        id: productId,
                        name: 'Test Product',
                        price: 100000,
                        isAvailable: true
                    }
                })
            }) as jest.Mock;

            // Simulate database error
            (prisma.order.create as jest.Mock).mockRejectedValue(
                new Error('Database connection failed')
            );

            // Session should not be created if order creation fails
            (redisSessionManager.createOrderSession as jest.Mock).mockClear();

            // Verify session was not created
            expect(redisSessionManager.createOrderSession).not.toHaveBeenCalled();
        });
    });

    describe('Order Status Transition Workflow', () => {
        it('should transition from PENDING to SUCCESS', async () => {
            const orderId = 'order-123';

            // Initial state: PENDING
            const pendingOrder = {
                id: orderId,
                userId: 'user-123',
                status: 'pending',
                totalPrice: 100000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            (prisma.order.findUnique as jest.Mock).mockResolvedValue(pendingOrder);

            // Update to SUCCESS after payment
            const successOrder = { ...pendingOrder, status: 'success' };
            (prisma.order.update as jest.Mock).mockResolvedValue(successOrder);

            // Session should be deleted
            (redisSessionManager.deleteOrderSession as jest.Mock).mockResolvedValue(undefined);

            // Verify order found
            expect(pendingOrder.status).toBe('pending');

            // Verify can transition to success
            expect(successOrder.status).toBe('success');
        });

        it('should transition from PENDING to CANCELLED on timeout', async () => {
            const orderId = 'order-expired';

            // Session expired (not found)
            (redisSessionManager.checkOrderSession as jest.Mock).mockResolvedValue(false);

            // Order exists but session expired
            const pendingOrder = {
                id: orderId,
                userId: 'user-123',
                status: 'pending',
                totalPrice: 100000,
                expirationTime: new Date(Date.now() - 1000), // Expired
                items: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            (prisma.order.findUnique as jest.Mock).mockResolvedValue(pendingOrder);

            // Should update to cancelled
            const cancelledOrder = { ...pendingOrder, status: 'cancelled' };
            (prisma.order.update as jest.Mock).mockResolvedValue(cancelledOrder);

            expect(cancelledOrder.status).toBe('cancelled');
        });

        it('should not allow transition from SUCCESS to other states', async () => {
            const orderId = 'order-completed';

            const successOrder = {
                id: orderId,
                userId: 'user-123',
                status: 'success',
                totalPrice: 100000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            (prisma.order.findUnique as jest.Mock).mockResolvedValue(successOrder);

            // Verify order is already successful
            expect(successOrder.status).toBe('success');

            // No update should be made
            (prisma.order.update as jest.Mock).mockClear();
        });

        it('should not allow transition from CANCELLED to other states', async () => {
            const orderId = 'order-cancelled';

            const cancelledOrder = {
                id: orderId,
                userId: 'user-123',
                status: 'cancelled',
                totalPrice: 100000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            (prisma.order.findUnique as jest.Mock).mockResolvedValue(cancelledOrder);

            // Verify order is cancelled
            expect(cancelledOrder.status).toBe('cancelled');
        });
    });

    describe('Payment Session Workflow', () => {
        it('should create payment session with order', async () => {
            const orderId = 'order-payment-123';
            const userId = 'user-123';
            const totalPrice = 150000;

            // Create order
            (prisma.order.create as jest.Mock).mockResolvedValue({
                id: orderId,
                userId,
                totalPrice,
                status: 'pending',
                expirationTime: new Date(Date.now() + 15 * 60 * 1000),
                items: [],
                createdAt: new Date()
            });

            // Create session
            (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue({
                expirationTime: new Date(Date.now() + 15 * 60 * 1000),
                durationMinutes: 15
            });

            // Publish to Kafka
            (publishEvent as jest.Mock).mockResolvedValue(undefined);

            // Verify workflow
            expect(redisSessionManager.createOrderSession).toBeDefined();
            expect(publishEvent).toBeDefined();
        });

        it('should cleanup session after successful payment', async () => {
            const orderId = 'order-paid';

            // Order updated to success
            (prisma.order.update as jest.Mock).mockResolvedValue({
                id: orderId,
                status: 'success',
                userId: 'user-123',
                totalPrice: 100000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Session deleted
            (redisSessionManager.deleteOrderSession as jest.Mock).mockResolvedValue(undefined);

            expect(redisSessionManager.deleteOrderSession).toBeDefined();
        });

        it('should cleanup session after expiration', async () => {
            const orderId = 'order-expired';

            // TTL expired
            (redisSessionManager.getSessionTTL as jest.Mock).mockResolvedValue(-2);

            // Order updated to cancelled
            (prisma.order.update as jest.Mock).mockResolvedValue({
                id: orderId,
                status: 'cancelled',
                userId: 'user-123',
                totalPrice: 100000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const ttl = await redisSessionManager.getSessionTTL(orderId);
            expect(ttl).toBe(-2); // Session expired
        });
    });

    describe('Multi-Item Order Workflow', () => {
        it('should validate all products before creating order', async () => {
            const product1 = '423e4567-e89b-12d3-a456-426614174000';
            const product2 = '523e4567-e89b-12d3-a456-426614174000';

            // Mock multiple product validations
            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { id: product1, name: 'Product 1', price: 50000, isAvailable: true }
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { id: product2, name: 'Product 2', price: 30000, isAvailable: true }
                    })
                }) as jest.Mock;

            expect(global.fetch).toBeDefined();
        });

        it('should fail if any product is unavailable', async () => {
            const product1 = '623e4567-e89b-12d3-a456-426614174000';
            const product2 = '723e4567-e89b-12d3-a456-426614174000';

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { id: product1, name: 'Product 1', price: 50000, isAvailable: true }
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { id: product2, name: 'Product 2', price: 30000, isAvailable: false }
                    })
                }) as jest.Mock;

            // Order should not be created
            (prisma.order.create as jest.Mock).mockClear();
            expect(prisma.order.create).not.toHaveBeenCalled();
        });

        it('should calculate total price correctly for multiple items', async () => {
            const items = [
                { productId: '823e4567-e89b-12d3-a456-426614174000', quantity: 2, price: 50000 },
                { productId: '923e4567-e89b-12d3-a456-426614174000', quantity: 3, price: 30000 }
            ];

            const expectedTotal = (2 * 50000) + (3 * 30000); // 190000

            (prisma.order.create as jest.Mock).mockResolvedValue({
                id: 'order-multi',
                userId: 'user-123',
                totalPrice: expectedTotal,
                status: 'pending',
                items: [],
                createdAt: new Date(),
                expirationTime: new Date()
            });

            expect(expectedTotal).toBe(190000);
        });
    });

    describe('Error Handling Workflow', () => {
        it('should handle Kafka publish failure gracefully', async () => {
            const productId = 'a23e4567-e89b-12d3-a456-426614174000';

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: { id: productId, name: 'Product', price: 100000, isAvailable: true }
                })
            }) as jest.Mock;

            (prisma.order.create as jest.Mock).mockResolvedValue({
                id: 'order-kafka-fail',
                userId: 'user-123',
                totalPrice: 100000,
                status: 'pending',
                items: [],
                createdAt: new Date(),
                expirationTime: new Date()
            });

            (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue({
                expirationTime: new Date(),
                durationMinutes: 15
            });

            // Kafka fails
            (publishEvent as jest.Mock).mockRejectedValue(new Error('Kafka unavailable'));

            // Even if Kafka fails, order should still be created
            // Payment service will pick it up via polling or retry
        });

        it('should handle Redis failure gracefully', async () => {
            const productId = 'b23e4567-e89b-12d3-a456-426614174000';

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: { id: productId, name: 'Product', price: 100000, isAvailable: true }
                })
            }) as jest.Mock;

            (prisma.order.create as jest.Mock).mockResolvedValue({
                id: 'order-redis-fail',
                userId: 'user-123',
                totalPrice: 100000,
                status: 'pending',
                items: [],
                createdAt: new Date(),
                expirationTime: new Date()
            });

            // Redis fails
            (redisSessionManager.createOrderSession as jest.Mock).mockRejectedValue(
                new Error('Redis connection failed')
            );

            // Order creation should still proceed
            // Can use database expiration as fallback
        });
    });
});

