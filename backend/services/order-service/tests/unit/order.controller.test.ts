import { Request, Response } from 'express';
import { createOrder, getOrderStatus, getPaymentUrl, getUserOrders } from '../../src/controllers/order';
import prisma from '../../src/lib/prisma';
import { publishEvent } from '../../src/utils/kafka';
import * as redisSessionManager from '../../src/utils/redisSessionManager';

interface AuthenticatedRequest extends Request {
    user?: { id: string };
}

describe('Order Controller - createOrder', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });

        mockReq = {
            user: { id: 'user-123' },
            body: {},
        };

        mockRes = {
            status: statusMock,
            json: jsonMock,
        };

        jest.clearAllMocks();
    });

    it('should create order successfully with valid data', async () => {
        const productId = '123e4567-e89b-12d3-a456-426614174000';
        const mockOrder = {
            id: 'order-123',
            userId: 'user-123',
            totalPrice: 100000,
            deliveryAddress: '123 Test Street',
            contactPhone: '0123456789',
            note: 'Test note',
            status: 'pending',
            expirationTime: new Date(),
            createdAt: new Date(),
            items: [
                {
                    productId: productId,
                    productName: 'Pizza',
                    productPrice: 50000,
                    quantity: 2,
                }
            ]
        };

        mockReq.body = {
            items: [{ productId: productId, quantity: 2 }],
            deliveryAddress: '123 Test Street',
            contactPhone: '0123456789',
            note: 'Test note',
        };

        // Mock fetch cho Product Service
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    id: productId,
                    name: 'Pizza',
                    price: 50000,
                    isAvailable: true,
                }
            })
        }) as jest.Mock;

        // Mock Prisma
        (prisma.order.create as jest.Mock).mockResolvedValue(mockOrder);

        // Mock Redis session
        (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue({
            expirationTime: new Date(),
            durationMinutes: 15
        });

        // Mock Kafka
        (publishEvent as jest.Mock).mockResolvedValue(undefined);

        await createOrder(mockReq as AuthenticatedRequest, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: expect.stringContaining('Đơn hàng đã được tạo'),
            })
        );
    });

    it('should return 401 if user is not authenticated', async () => {
        mockReq.user = undefined;

        await createOrder(mockReq as AuthenticatedRequest, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
            success: false,
            message: 'Unauthorized: No user ID found'
        });
    });

    it('should return 400 if validation fails', async () => {
        mockReq.body = {
            items: [], // Empty items array
        };

        await createOrder(mockReq as AuthenticatedRequest, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
            })
        );
    });

    it('should handle product not available error', async () => {
        const productId = '223e4567-e89b-12d3-a456-426614174000';
        mockReq.body = {
            items: [{ productId: productId, quantity: 2 }],
            deliveryAddress: '123 Test Street',
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    id: productId,
                    name: 'Pizza',
                    price: 50000,
                    isAvailable: false, // Product not available
                }
            })
        }) as jest.Mock;

        await createOrder(mockReq as AuthenticatedRequest, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('không còn kinh doanh')
            })
        );
    });

    it('should handle product service error', async () => {
        const productId = '323e4567-e89b-12d3-a456-426614174000';
        mockReq.body = {
            items: [{ productId: productId, quantity: 2 }],
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
        }) as jest.Mock;

        await createOrder(mockReq as AuthenticatedRequest, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
            })
        );
    });

    it('should calculate total price correctly for multiple items', async () => {
        const productId1 = '423e4567-e89b-12d3-a456-426614174000';
        const productId2 = '523e4567-e89b-12d3-a456-426614174000';

        mockReq.body = {
            items: [
                { productId: productId1, quantity: 2 },
                { productId: productId2, quantity: 1 },
            ],
        };

        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: { id: productId1, name: 'Pizza', price: 50000, isAvailable: true }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: { id: productId2, name: 'Burger', price: 30000, isAvailable: true }
                })
            }) as jest.Mock;

        (prisma.order.create as jest.Mock).mockResolvedValue({
            id: 'order-123',
            userId: 'user-123',
            totalPrice: 130000, // 2*50000 + 1*30000
            status: 'pending',
            items: [],
            createdAt: new Date(),
            expirationTime: new Date(),
        });

        (redisSessionManager.createOrderSession as jest.Mock).mockResolvedValue({
            expirationTime: new Date(),
            durationMinutes: 15
        });

        (publishEvent as jest.Mock).mockResolvedValue(undefined);

        await createOrder(mockReq as AuthenticatedRequest, mockRes as Response);

        expect(prisma.order.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    totalPrice: 130000
                })
            })
        );
    });
});

describe('Order Controller - getOrderStatus', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });

        mockReq = {
            user: { id: 'user-123' },
            params: {},
        };

        mockRes = {
            status: statusMock,
            json: jsonMock,
        };

        jest.clearAllMocks();
    });

    it('should get order status successfully', async () => {
        const mockOrder = {
            id: 'order-123',
            userId: 'user-123',
            status: 'success',
            totalPrice: 100000,
            deliveryAddress: '123 Test Street',
            contactPhone: '0123456789',
            note: 'Test note',
            items: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        mockReq.params = { orderId: 'order-123' };
        (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

        await getOrderStatus(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Lấy trạng thái đơn hàng thành công'
            })
        );
    });

    it('should return 401 if user not authenticated', async () => {
        mockReq.user = undefined;

        await getOrderStatus(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 404 if order not found', async () => {
        mockReq.params = { orderId: 'non-existent' };
        (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

        await getOrderStatus(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'Không tìm thấy đơn hàng'
            })
        );
    });

    it('should return 400 if orderId is missing', async () => {
        mockReq.params = {};

        await getOrderStatus(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
    });
});

describe('Order Controller - getPaymentUrl', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });

        mockReq = {
            user: { id: 'user-123' },
            params: {},
        };

        mockRes = {
            status: statusMock,
            json: jsonMock,
        };

        jest.clearAllMocks();
    });

    it('should return message for successful payment', async () => {
        mockReq.params = { orderId: 'order-123' };

        (prisma.order.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-123',
            userId: 'user-123',
            status: 'success',
        });

        await getPaymentUrl(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Đơn hàng đã được thanh toán thành công',
                paymentStatus: 'success'
            })
        );
    });

    it('should return message for cancelled order', async () => {
        mockReq.params = { orderId: 'order-123' };

        (prisma.order.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-123',
            userId: 'user-123',
            status: 'cancelled',
        });

        await getPaymentUrl(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('hết hạn')
            })
        );
    });

    it('should return pending status for pending order', async () => {
        mockReq.params = { orderId: 'order-123' };

        (prisma.order.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-123',
            userId: 'user-123',
            status: 'pending',
        });

        await getPaymentUrl(mockReq as any, mockRes as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: expect.stringContaining('Đang xử lý')
            })
        );
    });
});

describe('Order Controller - getUserOrders', () => {
    let mockReq: Partial<AuthenticatedRequest>;
    let mockRes: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });

        mockReq = {
            user: { id: 'user-123' },
            query: {},
        };

        mockRes = {
            status: statusMock,
            json: jsonMock,
        };

        jest.clearAllMocks();
    });

    it('should get user orders with pagination', async () => {
        const mockOrders = [
            {
                id: 'order-1',
                userId: 'user-123',
                status: 'success',
                totalPrice: 100000,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ];

        mockReq.query = { page: '1', limit: '10' };
        (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
        (prisma.order.count as jest.Mock).mockResolvedValue(1);

        await getUserOrders(mockReq as any, mockRes as Response);

        expect(prisma.order.findMany).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should filter orders by status', async () => {
        mockReq.query = { status: 'success' };
        (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.order.count as jest.Mock).mockResolvedValue(0);

        await getUserOrders(mockReq as any, mockRes as Response);

        expect(prisma.order.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: 'success'
                })
            })
        );
    });
});

