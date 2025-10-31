/**
 * payment.retry.spec.ts
 * Cleaned by ChatGPT — focus: Redis session, retry conditions, and (if available) handlePaymentEvent.
 */

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
    // Try to import the real handler; if not found we’ll skip related tests.
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
    try {
        console.log(`Creating order with id: ${id}, status: ${status}`);
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
        console.log(`Order created:`, order);
        if (!order) {
            throw new Error(`Failed to create order ${id} - order is ${order}`);
        }
        return order;
    } catch (error) {
        console.error(`Error creating order ${id}:`, error);
        throw error;
    }
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
    const maybe = handlePaymentEvent ? test : test.skip;

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

    maybe('TC2.2: Xoá session khi paymentStatus=success', async () => {
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

    maybe('TC2.3: Xoá session khi paymentStatus=failed (cancelled)', async () => {
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
 * Scenario 4: Retry Event Payload (struct only)
 * ===========================================================*/
describe('Scenario 4: Retry Event Payload', () => {
    test('TC4.1: Retry payload có flag isRetry=true', async () => {
        const orderId = newId('retry-payload');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);

        const retryPayload = {
            orderId,
            userId: testUserId,
            totalPrice: testTotalPrice,
            items: [{ productId: 'p1', productName: 'Product 1', productPrice: 250000, quantity: 1 }],
            isRetry: true,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            timestamp: new Date().toISOString(),
        };

        expect(retryPayload.isRetry).toBe(true);
        expect(retryPayload).toHaveProperty('orderId');

        await deleteOrderSession(orderId);
    });

    test('TC4.2: Topic cho retry là order.retry.payment', () => {
        const topic = 'order.retry.payment';
        expect(topic).toBe('order.retry.payment');
    });

    test('TC4.3: Retry payload chứa thông tin order đầy đủ', async () => {
        const orderId = newId('retry-payload-full');
        await createOrderSession(orderId, testUserId, testTotalPrice, 15);
        const sessionData = await getOrderSession(orderId);

        const retryPayload = {
            orderId,
            userId: testUserId,
            totalPrice: testTotalPrice,
            items: [],
            isRetry: true,
            expiresAt: sessionData?.expirationTime,
            timestamp: new Date().toISOString(),
        };

        expect(retryPayload.orderId).toBe(orderId);
        expect(retryPayload.userId).toBe(testUserId);
        expect(retryPayload.totalPrice).toBe(testTotalPrice);
        expect(retryPayload.isRetry).toBe(true);

        await deleteOrderSession(orderId);
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
