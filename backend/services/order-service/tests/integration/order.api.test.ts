import request from 'supertest';
import express, { Express } from 'express';
import prisma from '../../src/lib/prisma';
import * as redisSessionManager from '../../src/utils/redisSessionManager';
import { publishEvent } from '../../src/utils/kafka';

// Mock authMiddleware before importing routes
jest.mock('../../src/middleware/authMiddleware', () => ({
    authMiddleware: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user-123' };
        next();
    }
}));

// Import routes after mocking middleware
import { orderRoute } from '../../src/routes/order.routes';

// Create Express app for testing
const createTestApp = (): Express => {
    const app = express();
    app.use(express.json());
    app.use('/api/orders', orderRoute);

    return app;
};

describe('Order API Integration Tests', () => {
    let app: Express;

    beforeAll(() => {
        app = createTestApp();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/orders/create - Create Order', () => {
        it('should create a new order successfully', async () => {
            const productId = '123e4567-e89b-12d3-a456-426614174000';
            const orderData = {
                items: [
                    { productId: productId, quantity: 2 }
                ],
                deliveryAddress: '123 Test Street, District 1, HCMC',
                contactPhone: '0123456789',
                note: 'Please ring doorbell'
            };

            // Mock Product Service
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        id: productId,
                        name: 'Bánh Pizza Hải Sản',
                        price: 150000,
                        isAvailable: true
                    }
                })
            }) as jest.Mock;

            // Mock Prisma
            (prisma.order.create as jest.Mock).mockResolvedValue({
                id: 'order-123',
                userId: 'test-user-123',
                totalPrice: 300000,
                deliveryAddress: orderData.deliveryAddress,
                contactPhone: orderData.contactPhone,
                note: orderData.note,
                status: 'pending',
                expirationTime: new Date(Date.now() + 15 * 60 * 1000),
                createdAt: new Date(),
                items: [{
                    productId: productId,
                    productName: 'Bánh Pizza Hải Sản',
                    productPrice: 150000,
                    quantity: 2
                }]
            });

            // Mock Redis
            (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue({
                expirationTime: new Date(Date.now() + 15 * 60 * 1000),
                durationMinutes: 15
            });

            // Mock Kafka
            (publishEvent as jest.Mock).mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(201);

            expect(response.body.success).toBe(false);
            expect(response.body.data).toHaveProperty('orderId');
            expect(response.body.data.totalPrice).toBe(300000);
            expect(response.body.data.status).toBe('pending');
            expect(response.body.data.session).toBeDefined();
        });

        it('should reject order with invalid UUID format', async () => {
            const orderData = {
                items: [
                    { productId: 'invalid-uuid-format', quantity: 2 }
                ],
                deliveryAddress: '123 Test Street'
            };

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('UUID hợp lệ');
        });

        it('should reject order with empty items array', async () => {
            const orderData = {
                items: [],
                deliveryAddress: '123 Test Street'
            };

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('ít nhất 1 sản phẩm');
        });

        it('should reject order with zero quantity', async () => {
            const productId = '223e4567-e89b-12d3-a456-426614174000';
            const orderData = {
                items: [
                    { productId: productId, quantity: 0 }
                ]
            };

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should reject order when product is not available', async () => {
            const productId = '323e4567-e89b-12d3-a456-426614174000';
            const orderData = {
                items: [{ productId: productId, quantity: 2 }]
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        id: productId,
                        name: 'Unavailable Product',
                        price: 50000,
                        isAvailable: false
                    }
                })
            }) as jest.Mock;

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('không còn kinh doanh');
        });

        it('should calculate correct total price for multiple items', async () => {
            const productId1 = '423e4567-e89b-12d3-a456-426614174000';
            const productId2 = '523e4567-e89b-12d3-a456-426614174000';

            const orderData = {
                items: [
                    { productId: productId1, quantity: 2 },
                    { productId: productId2, quantity: 3 }
                ],
                deliveryAddress: '456 Another Street'
            };

            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { id: productId1, name: 'Burger', price: 50000, isAvailable: true }
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { id: productId2, name: 'Fries', price: 30000, isAvailable: true }
                    })
                }) as jest.Mock;

            (prisma.order.create as jest.Mock).mockResolvedValue({
                id: 'order-456',
                userId: 'test-user-123',
                totalPrice: 190000, // (2*50000) + (3*30000)
                status: 'pending',
                expirationTime: new Date(),
                createdAt: new Date(),
                items: [],
                deliveryAddress: orderData.deliveryAddress,
                contactPhone: null,
                note: null
            });

            (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue({
                expirationTime: new Date(),
                durationMinutes: 15
            });

            (publishEvent as jest.Mock).mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(201);

            expect(response.body.data.totalPrice).toBe(190000);
        });

        it('should handle product service unavailable error', async () => {
            const productId = '623e4567-e89b-12d3-a456-426614174000';
            const orderData = {
                items: [{ productId: productId, quantity: 1 }]
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404
            }) as jest.Mock;

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should create order without optional fields', async () => {
            const productId = '723e4567-e89b-12d3-a456-426614174000';
            const orderData = {
                items: [{ productId: productId, quantity: 1 }]
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        id: productId,
                        name: 'Simple Product',
                        price: 100000,
                        isAvailable: true
                    }
                })
            }) as jest.Mock;

            (prisma.order.create as jest.Mock).mockResolvedValue({
                id: 'order-789',
                userId: 'test-user-123',
                totalPrice: 100000,
                status: 'pending',
                expirationTime: new Date(),
                createdAt: new Date(),
                items: [],
                deliveryAddress: null,
                contactPhone: null,
                note: null
            });

            (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue({
                expirationTime: new Date(),
                durationMinutes: 15
            });

            (publishEvent as jest.Mock).mockResolvedValue(undefined);

            const response = await request(app)
                .post('/api/orders/create')
                .send(orderData)
                .expect(201);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/orders/status/:orderId - Get Order Status', () => {
        it('should get order status successfully', async () => {
            const orderId = 'order-123';

            (prisma.order.findUnique as jest.Mock).mockResolvedValue({
                id: orderId,
                userId: 'test-user-123',
                status: 'success',
                totalPrice: 200000,
                deliveryAddress: '123 Test Street',
                contactPhone: '0123456789',
                note: 'Test note',
                items: [{
                    productId: '123e4567-e89b-12d3-a456-426614174000',
                    productName: 'Pizza',
                    productPrice: 100000,
                    quantity: 2
                }],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const response = await request(app)
                .get(`/api/orders/status/${orderId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.orderId).toBe(orderId);
            expect(response.body.data.status).toBe('success');
            expect(response.body.data.items).toHaveLength(1);
        });

        it('should return 404 for non-existent order', async () => {
            (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

            const response = await request(app)
                .get('/api/orders/status/non-existent-order')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Không tìm thấy');
        });

        it('should return 400 when orderId is missing', async () => {
            const response = await request(app)
                .get('/api/orders/status/')
                .expect(404); // Express returns 404 for missing route params

            // This tests the Express routing behavior
        });

        it('should verify order belongs to authenticated user', async () => {
            // This test ensures the query includes userId check
            const orderId = 'order-other-user';

            (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

            const response = await request(app)
                .get(`/api/orders/status/${orderId}`)
                .expect(404);

            expect(prisma.order.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'test-user-123'
                    })
                })
            );
        });
    });

    describe('GET /api/orders/payment-url/:orderId - Get Payment URL', () => {
        it('should return success message for completed payment', async () => {
            const orderId = 'order-success';

            (prisma.order.findUnique as jest.Mock).mockResolvedValue({
                id: orderId,
                userId: 'test-user-123',
                status: 'success'
            });

            const response = await request(app)
                .get(`/api/orders/payment-url/${orderId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.paymentStatus).toBe('success');
            expect(response.body.message).toContain('thanh toán thành công');
        });

        it('should return cancelled message for expired order', async () => {
            const orderId = 'order-cancelled';

            (prisma.order.findUnique as jest.Mock).mockResolvedValue({
                id: orderId,
                userId: 'test-user-123',
                status: 'cancelled'
            });

            const response = await request(app)
                .get(`/api/orders/payment-url/${orderId}`)
                .expect(200);

            expect(response.body.success).toBe(false);
            expect(response.body.paymentStatus).toBe('cancelled');
            expect(response.body.message).toContain('hết hạn');
        });

        it('should return pending status for processing order', async () => {
            const orderId = 'order-pending';

            (prisma.order.findUnique as jest.Mock).mockResolvedValue({
                id: orderId,
                userId: 'test-user-123',
                status: 'pending'
            });

            const response = await request(app)
                .get(`/api/orders/payment-url/${orderId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.paymentStatus).toBe('pending');
            expect(response.body.message).toContain('Đang xử lý');
        });

        it('should return 404 for non-existent order', async () => {
            (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

            const response = await request(app)
                .get('/api/orders/payment-url/non-existent')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/orders/list - Get User Orders', () => {
        it('should get user orders with default pagination', async () => {
            const mockOrders = [
                {
                    id: 'order-1',
                    userId: 'test-user-123',
                    status: 'success',
                    totalPrice: 100000,
                    deliveryAddress: 'Address 1',
                    contactPhone: '0123456789',
                    note: null,
                    expirationTime: new Date(),
                    items: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    id: 'order-2',
                    userId: 'test-user-123',
                    status: 'pending',
                    totalPrice: 200000,
                    deliveryAddress: 'Address 2',
                    contactPhone: '0987654321',
                    note: 'Note 2',
                    expirationTime: new Date(),
                    items: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
            (prisma.order.count as jest.Mock).mockResolvedValue(2);

            const response = await request(app)
                .get('/api/orders/list')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.pagination).toBeDefined();
        });

        it('should filter orders by status', async () => {
            const successOrders = [{
                id: 'order-success',
                userId: 'test-user-123',
                status: 'success',
                totalPrice: 150000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                deliveryAddress: null,
                contactPhone: null,
                note: null,
                expirationTime: new Date()
            }];

            (prisma.order.findMany as jest.Mock).mockResolvedValue(successOrders);
            (prisma.order.count as jest.Mock).mockResolvedValue(1);

            const response = await request(app)
                .get('/api/orders/list?status=success')
                .expect(200);

            expect(prisma.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: 'success'
                    })
                })
            );

            expect(response.body.data).toHaveLength(1);
        });

        it('should support custom pagination parameters', async () => {
            (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.order.count as jest.Mock).mockResolvedValue(0);

            const response = await request(app)
                .get('/api/orders/list?page=2&limit=5')
                .expect(200);

            expect(prisma.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 5, // (page 2 - 1) * limit 5
                    take: 5
                })
            );
        });

        it('should return empty array when no orders found', async () => {
            (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.order.count as jest.Mock).mockResolvedValue(0);

            const response = await request(app)
                .get('/api/orders/list')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });

        it('should order results by createdAt descending', async () => {
            (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
            (prisma.order.count as jest.Mock).mockResolvedValue(0);

            await request(app)
                .get('/api/orders/list')
                .expect(200);

            expect(prisma.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { createdAt: 'desc' }
                })
            );
        });
    });

    describe('GET /api/orders/my-orders - Get User Orders (Alias)', () => {
        it('should work as alias for /list endpoint', async () => {
            const mockOrders = [{
                id: 'order-1',
                userId: 'test-user-123',
                status: 'success',
                totalPrice: 100000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                deliveryAddress: null,
                contactPhone: null,
                note: null,
                expirationTime: new Date()
            }];

            (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
            (prisma.order.count as jest.Mock).mockResolvedValue(1);

            const response = await request(app)
                .get('/api/orders/my-orders')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
        });
    });
});

