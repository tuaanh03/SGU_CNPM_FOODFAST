import redisClient from '../lib/redis';
import prisma from '../lib/prisma';
import { publishOrderExpirationEvent } from './kafka';

/**
 * Redis Order Session Manager
 * Quản lý session timeout cho orders bằng Redis TTL
 */

// Cấu hình
const ORDER_SESSION_DURATION_MINUTES = parseInt(process.env.ORDER_SESSION_DURATION_MINUTES || '15');
const REDIS_KEY_PREFIX = 'order:session:';

/**
 * Tạo session cho order trong Redis với TTL
 * Key format: order:session:{orderId}
 * Value: {userId, totalPrice, createdAt}
 * TTL: ORDER_SESSION_DURATION_MINUTES phút
 */
export async function createOrderSession(
    orderId: string,
    userId: string,
    totalPrice: number,
    sessionDurationMinutes: number = ORDER_SESSION_DURATION_MINUTES
): Promise<{ expirationTime: Date; durationMinutes: number }> {
    const key = `${REDIS_KEY_PREFIX}${orderId}`;
    const ttlSeconds = sessionDurationMinutes * 60;

    // Tính thời gian hết hạn
    const expirationTime = new Date(Date.now() + ttlSeconds * 1000);

    // Lưu session data vào Redis với TTL
    const sessionData = {
        orderId,
        userId,
        totalPrice,
        createdAt: new Date().toISOString(),
        expirationTime: expirationTime.toISOString(),
    };

    await redisClient.setex(
        key,
        ttlSeconds,
        JSON.stringify(sessionData)
    );

    console.log(`✅ Created Redis session for order ${orderId}, expires in ${sessionDurationMinutes} minutes`);

    return {
        expirationTime,
        durationMinutes: sessionDurationMinutes
    };
}

/**
 * Kiểm tra session có còn tồn tại không
 */
export async function checkOrderSession(orderId: string): Promise<boolean> {
    const key = `${REDIS_KEY_PREFIX}${orderId}`;
    const exists = await redisClient.exists(key);
    return exists === 1;
}

/**
 * Lấy thông tin session
 */
export async function getOrderSession(orderId: string): Promise<any | null> {
    const key = `${REDIS_KEY_PREFIX}${orderId}`;
    const data = await redisClient.get(key);

    if (!data) return null;

    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Error parsing session data:', error);
        return null;
    }
}

/**
 * Xóa session (khi thanh toán thành công)
 */
export async function deleteOrderSession(orderId: string): Promise<void> {
    const key = `${REDIS_KEY_PREFIX}${orderId}`;
    await redisClient.del(key);
    console.log(`🗑️  Deleted Redis session for order ${orderId}`);
}

/**
 * Lấy TTL còn lại của session (giây)
 */
export async function getSessionTTL(orderId: string): Promise<number> {
    const key = `${REDIS_KEY_PREFIX}${orderId}`;
    return await redisClient.ttl(key); // -1: no expire, -2: key not exists, >0: seconds remaining
}

/**
 * Handler cho Redis keyspace notifications (expired events)
 * Phải bật config: notify-keyspace-events Ex
 *
 * Hàm này sẽ được gọi khi một key hết hạn
 */
export async function handleExpiredOrderSession(expiredKey: string): Promise<void> {
    try {
        // expiredKey format: order:session:{orderId}
        const orderId = expiredKey.replace(REDIS_KEY_PREFIX, '');

        console.log(`⏰ Order session expired: ${orderId}`);

        // Cập nhật trạng thái order trong database
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            console.log(`Order ${orderId} not found in database`);
            return;
        }

        // Chỉ cập nhật nếu order vẫn đang pending
        if (order.status === 'pending') {
            await prisma.order.update({
                where: { id: orderId },
                data: { status: 'cancelled' }
            });

            console.log(`✅ Updated order ${orderId} status to CANCELLED (expired)`);

            // Gửi event đến Payment Service để cập nhật PaymentIntent và PaymentAttempt
            try {
                await publishOrderExpirationEvent({
                    orderId: order.id,
                    userId: order.userId,
                    storeId: order.storeId || null,
                    reason: 'SESSION_EXPIRED',
                    timestamp: new Date().toISOString()
                });
                console.log(`📤 Published order.expired event for order ${orderId}`);
            } catch (kafkaError) {
                console.error(`Failed to publish order.expired event for order ${orderId}:`, kafkaError);
            }
        } else {
            console.log(`Order ${orderId} already has status: ${order.status}, skipping update`);
        }

    } catch (error) {
        console.error('Error handling expired order session:', error);
    }
}

/**
 * Khởi tạo listener cho Redis expired events
 * Phải gọi hàm này khi start server
 */
export async function initializeRedisExpirationListener(): Promise<void> {
    try {
        // Đảm bảo main client đã ready
        await redisClient.ping();
        console.log('✅ Main Redis client is ready');

        // Enable keyspace notifications cho expired events
        // Cần thiết cho Railway Redis hoặc Redis không có config sẵn
        try {
            await redisClient.config('SET', 'notify-keyspace-events', 'Ex');
            console.log('✅ Redis keyspace notifications enabled (Ex)');
        } catch (configError: any) {
            console.warn('⚠️ Could not set notify-keyspace-events (may need manual config):', configError.message);
        }

        // Tạo subscriber client riêng cho pub/sub
        const subscriberClient = redisClient.duplicate();

        // Wait for subscriber to be ready
        await new Promise<void>((resolve, reject) => {
            subscriberClient.on('ready', () => {
                console.log('✅ Redis subscriber client ready');
                resolve();
            });
            subscriberClient.on('error', (err) => {
                console.error('❌ Redis subscriber error:', err.message);
                reject(err);
            });
            // Timeout after 10s
            setTimeout(() => reject(new Error('Redis subscriber timeout')), 10000);
        });

        // Subscribe vào channel expired events
        // Pattern: __keyevent@{db}__:expired
        const db = parseInt(process.env.REDIS_DB || '0');
        const expiredChannel = `__keyevent@${db}__:expired`;

        await subscriberClient.subscribe(expiredChannel);
        console.log(`✅ Subscribed to Redis expired events on channel: ${expiredChannel}`);

        // Handle expired events
        subscriberClient.on('message', async (channel, message) => {
            // message chính là key đã expired
            if (message.startsWith(REDIS_KEY_PREFIX)) {
                await handleExpiredOrderSession(message);
            }
        });

        console.log('🎧 Redis expiration listener initialized successfully');
    } catch (error: any) {
        console.error('❌ Failed to initialize Redis expiration listener:', error.message);
        console.error('⚠️ Order expiration events will NOT work!');
        // Don't throw - let the service continue without expiration listener
    }
}
