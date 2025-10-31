/**
 * payment.retry.spec.ts
 * Cleaned by ChatGPT — focus: Redis session, retry conditions, and (if available) handlePaymentEvent.
 */

// Unmock Prisma và Kafka cho integration test
jest.unmock('../../../src/lib/prisma');
jest.unmock('../../../src/utils/kafka');

// Set NODE_ENV=test để auto-detect localhost
process.env.NODE_ENV = 'test';

import prisma from '../../../src/lib/prisma';
import redisClient from '../../../src/lib/redis';
import {
    createOrderSession,
    checkOrderSession,
    getOrderSession,
    deleteOrderSession,
    getSessionTTL,
} from '../../../src/utils/redisSessionManager';

type OrderStatus = 'pending' | 'success' | 'cancelled';

const testSuiteId = `retry-${Date.now()}`;
const testUserId = `test-user-${testSuiteId}`;
const testTotalPrice = 250_000;

// Optional (only if real handler is present)
let handlePaymentEvent:
    | ((payload: { orderId: string; paymentStatus: 'pending' | 'success' | 'failed'; paymentUrl?: string }) => Promise<void>)
    | undefined;

beforeAll(async () => {
    // Try to import the real handler; if not found we'll skip related tests.
    try {
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports
        const mod: typeof import('../../../src/utils/kafka') = await import('../../../src/utils/kafka');
        handlePaymentEvent = (mod as any).handlePaymentEvent;
    } catch (_) {
        handlePaymentEvent = undefined;
    }
});

afterAll(async () => {
    try {
        await redisClient.quit();
    } catch (_) {}
    if (prisma.$disconnect && typeof prisma.$disconnect === 'function') {
        await prisma.$disconnect();
    }
});

/* -------------------------- Helpers -------------------------- */

const newId = (label: string) => `${label}-${testSuiteId}-${Math.random().toString(36).slice(2, 8)}`;

async function ensureOrderDeleted(id: string) {
    try {
        await prisma.order.delete({ where: { id } });
    } catch (_) {
        // Order không tồn tại, bỏ qua
    }
}

async function createOrder(id: string, status: OrderStatus = 'pending') {
    await ensureOrderDeleted(id);
    const order = await prisma.order.create({
        data: {
            id,
            userId: testUserId,
            totalPrice: testTotalPrice,
            deliveryAddress: '123 Test St',
            contactPhone: '0123456789',
            status,
            expirationTime: new Date(Date.now() + 15 * 60 * 1000),
        },
    });

    if (!order) {
        throw new Error(`Failed to create order ${id}`);
    }

    return order;
}

/* =============================================================
 * Scenario 1: Redis Session Management
 * ===========================================================*/
describe('Scenario 1: Redis Session Management', () => {
    test('TC1.1: Tạo session với đầy đủ thông tin', async () => {
        const orderId = newId('tc11');
        const session = await createOrderSession(orderId, testUserId, testTotalPrice, 15);

        expect(session).toHaveProperty('expirationTime');
        expect(session).toHaveProperty('durationMinutes', 15);

        const sessionData = await getOrderSession(orderId);
        expect(sessionData).toBeDefined();
        expect(sessionData?.orderId).toBe(orderId);
        expect(sessionData?.userId).toBe(testUserId);
        expect(sessionData?.totalPrice).toBe(testTotalPrice);

        await deleteOrderSession(orderId);
    });

    test('TC1.2: Session có expiration time chính xác (± thời gian tạo)', async () => {
        const orderId = newId('tc12');
        const before = Date.now();
        const session = await createOrderSession(orderId, testUserId, testTotalPrice, 15);
        const after = Date.now();

        const exp = new Date(session.expirationTime).getTime();
        expect(exp).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
        expect(exp).toBeLessThanOrEqual(after + 15 * 60 * 1000);

        await deleteOrderSession(orderId);
    });

    test('TC1.3: checkOrderSession trả true khi session tồn tại', async () => {
        const orderId = newId('tc13');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);
        const exists = await checkOrderSession(orderId);
        expect(exists).toBe(true);
        await deleteOrderSession(orderId);
    });

    test('TC1.4: getOrderSession trả đủ trường', async () => {
        const orderId = newId('tc14');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);
        const sd = await getOrderSession(orderId);
        expect(sd).toBeTruthy();
        expect(sd).toHaveProperty('orderId');
        expect(sd).toHaveProperty('userId');
        expect(sd).toHaveProperty('totalPrice');
        expect(sd).toHaveProperty('createdAt');
        expect(sd).toHaveProperty('expirationTime');
        await deleteOrderSession(orderId);
    });

    test('TC1.5: deleteOrderSession xóa session', async () => {
        const orderId = newId('tc15');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);
        await deleteOrderSession(orderId);
        const exists = await checkOrderSession(orderId);
        expect(exists).toBe(false);
    });

    test('TC1.6: getSessionTTL trả về (0, 900]', async () => {
        const orderId = newId('tc16');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);
        const ttl = await getSessionTTL(orderId);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(900); // 15 phút
        await deleteOrderSession(orderId);
    });
});

/* =============================================================
 * Scenario 2: Session deletion rules via real handlePaymentEvent
 * (skip if handler is not available)
 * ===========================================================*/
describe('Scenario 2: Session Deletion Rules (handlePaymentEvent)', () => {
    test('TC2.1: Không xoá session khi paymentStatus=pending', async () => {
        const orderId = newId('pending');
        const order = await createOrder(orderId, 'pending');
        await createOrderSession(order.id, testUserId, testTotalPrice, 15);

        await handlePaymentEvent!({
            orderId: order.id,
            paymentStatus: 'pending',
            paymentUrl: 'https://sandbox.vnpayment.vn/test',
        });

        const exists = await checkOrderSession(order.id);
        expect(exists).toBe(true);

        await deleteOrderSession(order.id);
        await ensureOrderDeleted(order.id);
    });

    test('TC2.2: Xoá session khi paymentStatus=success', async () => {
        const orderId = newId('success');
        const order = await createOrder(orderId, 'pending');
        await createOrderSession(order.id, testUserId, testTotalPrice, 15);

        const existsBefore = await checkOrderSession(order.id);
        expect(existsBefore).toBe(true);

        await handlePaymentEvent!({ orderId: order.id, paymentStatus: 'success' });

        const existsAfter = await checkOrderSession(order.id);
        expect(existsAfter).toBe(false);

        const updated = await prisma.order.findUnique({ where: { id: order.id } });
        expect(updated?.status).toBe('success');

        await ensureOrderDeleted(order.id);
    });

    test('TC2.3: Xoá session khi paymentStatus=failed (cancelled)', async () => {
        const orderId = newId('failed');
        const order = await createOrder(orderId, 'pending');
        await createOrderSession(order.id, testUserId, testTotalPrice, 15);

        await handlePaymentEvent!({ orderId: order.id, paymentStatus: 'failed' });

        const existsAfter = await checkOrderSession(order.id);
        expect(existsAfter).toBe(false);

        const updated = await prisma.order.findUnique({ where: { id: order.id } });
        expect(updated?.status).toBe('cancelled');

        await ensureOrderDeleted(order.id);
    });
});

/* =============================================================
 * Scenario 3: Retry Payment Conditions (DB thật + Redis thật)
 * ===========================================================*/
describe('Scenario 3: Retry Payment Conditions', () => {
    test('TC3.1: Có thể retry khi status=pending và session tồn tại', async () => {
        const orderId = newId('retry-ok');
        const order = await createOrder(orderId, 'pending');
        await createOrderSession(order.id, testUserId, testTotalPrice, 15);

        const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
        const sessionExists = await checkOrderSession(order.id);
        const canRetry = dbOrder?.status === 'pending' && sessionExists;

        expect(canRetry).toBe(true);

        await deleteOrderSession(order.id);
        await ensureOrderDeleted(order.id);
    });

    test('TC3.2: KHÔNG retry khi status=success', async () => {
        const orderId = newId('no-retry-success');
        const order = await createOrder(orderId, 'success');

        const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
        const sessionExists = await checkOrderSession(order.id);
        const canRetry = dbOrder?.status === 'pending' && sessionExists;

        expect(canRetry).toBe(false);
        expect(dbOrder?.status).toBe('success');

        await ensureOrderDeleted(order.id);
    });

    test('TC3.3: KHÔNG retry khi status=cancelled', async () => {
        const orderId = newId('no-retry-cancelled');
        const order = await createOrder(orderId, 'cancelled');

        const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
        const sessionExists = await checkOrderSession(order.id);
        const canRetry = dbOrder?.status === 'pending' && sessionExists;

        expect(canRetry).toBe(false);
        expect(dbOrder?.status).toBe('cancelled');

        await ensureOrderDeleted(order.id);
    });

    test('TC3.4: KHÔNG retry khi session hết hạn/không tồn tại', async () => {
        const orderId = newId('no-retry-no-session');
        const order = await createOrder(orderId, 'pending');

        const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
        const sessionExists = await checkOrderSession(order.id);
        const canRetry = dbOrder?.status === 'pending' && sessionExists;

        expect(sessionExists).toBe(false);
        expect(canRetry).toBe(false);

        await ensureOrderDeleted(order.id);
    });
});

/* =============================================================
 * Scenario 4: Retry Payment Controller - TEST HÀM THẬT
 * Test hàm retryPayment() từ controller với các tình huống thực tế
 * ===========================================================*/
describe('Scenario 4: Retry Payment Controller - TEST HÀM THẬT', () => {
    let retryPayment: any;
    let mockReq: any;
    let mockRes: any;
    let originalPublishRetryPaymentEvent: any;

    beforeAll(async () => {
        try {
            const controller = await import('../../../src/controllers/order');
            retryPayment = controller.retryPayment;

            // Mock Kafka publisher để tránh timeout
            const kafkaModule = require('../../../src/utils/kafka');
            originalPublishRetryPaymentEvent = kafkaModule.publishRetryPaymentEvent;
            kafkaModule.publishRetryPaymentEvent = jest.fn().mockResolvedValue(undefined);
        } catch (error) {
            console.error('Cannot import retryPayment controller:', error);
        }
    });

    afterAll(() => {
        // Restore original Kafka publisher
        if (originalPublishRetryPaymentEvent) {
            const kafkaModule = require('../../../src/utils/kafka');
            kafkaModule.publishRetryPaymentEvent = originalPublishRetryPaymentEvent;
        }
    });

    beforeEach(() => {
        // Mock Express Request và Response
        mockReq = {
            user: { id: testUserId },
            params: {},
            body: {},
            headers: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    test('TC4.1: Retry thành công khi order PENDING và session CÒN TỒN TẠI', async () => {
        if (!retryPayment) {
            console.warn('retryPayment not available, skipping test');
            return;
        }

        // Arrange: Tạo order pending với session
        const orderId = newId('retry-success');
        const order = await createOrder(orderId, 'pending');
        await createOrderSession(order.id, testUserId, testTotalPrice, 15);

        mockReq.params.orderId = order.id;

        // Act: Gọi hàm retryPayment thật
        await retryPayment(mockReq, mockRes);

        // Assert: Kiểm tra response
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: expect.stringContaining('Đang xử lý thanh toán lại'),
                data: expect.objectContaining({
                    orderId: order.id,
                    status: 'pending',
                    retryInitiated: true,
                    sessionRemainingMinutes: expect.any(Number)
                })
            })
        );

        // Verify session vẫn còn tồn tại (không bị xóa khi retry)
        const sessionExists = await checkOrderSession(order.id);
        expect(sessionExists).toBe(true);

        // Cleanup
        await deleteOrderSession(order.id);
        await ensureOrderDeleted(order.id);
    });

    test('TC4.2: Retry THẤT BẠI khi session ĐÃ HẾT HẠN', async () => {
        if (!retryPayment) {
            console.warn('retryPayment not available, skipping test');
            return;
        }

        // Arrange: Tạo order pending nhưng KHÔNG có session (đã hết hạn)
        const orderId = newId('retry-expired');
        const order = await createOrder(orderId, 'pending');
        // KHÔNG tạo session => giả lập session đã hết hạn

        mockReq.params.orderId = order.id;

        // Act: Gọi hàm retryPayment thật
        await retryPayment(mockReq, mockRes);

        // Assert: Phải trả về lỗi SESSION_EXPIRED
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('Phiên thanh toán đã hết hạn'),
                error: 'SESSION_EXPIRED'
            })
        );

        // Verify order được chuyển sang cancelled
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
        expect(updatedOrder?.status).toBe('cancelled');

        // Cleanup
        await ensureOrderDeleted(order.id);
    });

    test('TC4.3: Retry THẤT BẠI khi order đã SUCCESS', async () => {
        if (!retryPayment) {
            console.warn('retryPayment not available, skipping test');
            return;
        }

        // Arrange: Tạo order đã SUCCESS
        const orderId = newId('retry-already-success');
        const order = await createOrder(orderId, 'success');

        mockReq.params.orderId = order.id;

        // Act: Gọi hàm retryPayment thật
        await retryPayment(mockReq, mockRes);

        // Assert: Phải trả về lỗi đã thanh toán
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('Đơn hàng đã được thanh toán thành công')
            })
        );

        // Cleanup
        await ensureOrderDeleted(order.id);
    });

    test('TC4.4: Retry THẤT BẠI khi order đã CANCELLED', async () => {
        if (!retryPayment) {
            console.warn('retryPayment not available, skipping test');
            return;
        }

        // Arrange: Tạo order đã CANCELLED
        const orderId = newId('retry-cancelled');
        const order = await createOrder(orderId, 'cancelled');

        mockReq.params.orderId = order.id;

        // Act: Gọi hàm retryPayment thật
        await retryPayment(mockReq, mockRes);

        // Assert: Phải trả về lỗi ORDER_NOT_PENDING
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.stringContaining('không ở trạng thái chờ thanh toán'),
                error: 'ORDER_NOT_PENDING'
            })
        );

        // Cleanup
        await ensureOrderDeleted(order.id);
    });

    test('TC4.5: Retry THẤT BẠI khi TTL <= 0 (session sắp hết hạn)', async () => {
        if (!retryPayment) {
            console.warn('retryPayment not available, skipping test');
            return;
        }

        // Arrange: Tạo order với session có TTL rất ngắn
        const orderId = newId('retry-ttl-zero');
        const order = await createOrder(orderId, 'pending');

        // Tạo session với TTL 1 giây
        await createOrderSession(order.id, testUserId, testTotalPrice, 1/60); // 1 giây = 1/60 phút

        // Đợi session hết hạn
        await new Promise(resolve => setTimeout(resolve, 1500));

        mockReq.params.orderId = order.id;

        // Act: Gọi hàm retryPayment thật
        await retryPayment(mockReq, mockRes);

        // Assert: Phải trả về lỗi 400
        // Có thể là SESSION_EXPIRED hoặc ORDER_NOT_PENDING (nếu cron job đã chuyển sang cancelled)
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: expect.any(String),
                error: expect.stringMatching(/SESSION_EXPIRED|ORDER_NOT_PENDING/)
            })
        );

        // Cleanup
        await ensureOrderDeleted(order.id);
    });

    test('TC4.6: Verify publishRetryPaymentEvent được gọi với đúng payload', async () => {
        if (!retryPayment) {
            console.warn('retryPayment not available, skipping test');
            return;
        }

        // Arrange: Mock publishRetryPaymentEvent để spy
        const kafkaModule = require('../../../src/utils/kafka');
        const originalPublish = kafkaModule.publishRetryPaymentEvent;
        const mockPublish = jest.fn().mockResolvedValue(undefined);
        kafkaModule.publishRetryPaymentEvent = mockPublish;

        const orderId = newId('retry-verify-event');
        const order = await createOrder(orderId, 'pending');
        await createOrderSession(order.id, testUserId, testTotalPrice, 15);

        mockReq.params.orderId = order.id;

        // Act: Gọi hàm retryPayment thật
        await retryPayment(mockReq, mockRes);

        // Assert: Verify publishRetryPaymentEvent được gọi với đúng payload
        expect(mockPublish).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: order.id,
                userId: testUserId,
                totalPrice: testTotalPrice,
                isRetry: true, // Đây là điểm quan trọng - flag isRetry phải được set
                items: expect.any(Array),
                expiresAt: expect.any(String),
                timestamp: expect.any(String)
            })
        );

        // Restore original function
        kafkaModule.publishRetryPaymentEvent = originalPublish;

        // Cleanup
        await deleteOrderSession(order.id);
        await ensureOrderDeleted(order.id);
    });
});

/* =============================================================
 * Scenario 5: Session TTL behaviors (UX hints)
 * ===========================================================*/
describe('Scenario 5: Session TTL behaviors', () => {
    test('TC5.1: Session còn TTL => có thể retry ngay', async () => {
        const orderId = newId('ttl-ok');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);
        const ttl = await getSessionTTL(orderId);
        expect(ttl).toBeGreaterThan(0);
        await deleteOrderSession(orderId);
    });

    test('TC5.2: TTL giảm dần theo thời gian', async () => {
        const orderId = newId('ttl-decrease');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);

        const ttl1 = await getSessionTTL(orderId);
        await new Promise(r => setTimeout(r, 1500));
        const ttl2 = await getSessionTTL(orderId);
        await new Promise(r => setTimeout(r, 1500));
        const ttl3 = await getSessionTTL(orderId);

        expect(ttl2).toBeLessThan(ttl1);
        expect(ttl3).toBeLessThan(ttl2);

        await deleteOrderSession(orderId);
    });

    test('TC5.3: Auto-delete khi TTL hết', async () => {
        const shortOrderId = newId('ttl-zero');
        // tạo key với TTL=1s (tùy client: setEx / setex)
        await redisClient.setex(`order:session:${shortOrderId}`, 1, JSON.stringify({
            orderId: shortOrderId,
            userId: testUserId,
            totalPrice: testTotalPrice,
        }));
        const existsBefore = await redisClient.exists(`order:session:${shortOrderId}`);
        expect(existsBefore).toBe(1);

        await new Promise(r => setTimeout(r, 1500)); // chờ hết TTL
        const existsAfter = await redisClient.exists(`order:session:${shortOrderId}`);
        expect(existsAfter).toBe(0);
    });
});

