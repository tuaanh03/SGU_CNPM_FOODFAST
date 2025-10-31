import Redis from 'ioredis';

// Auto-detect: Nếu REDIS_HOST là 'redis' (Docker) và đang ở test/dev local, dùng localhost
const isDockerHost = process.env.REDIS_HOST === 'redis';
const redisHost = (isDockerHost && process.env.NODE_ENV === 'test')
    ? 'localhost'
    : (process.env.REDIS_HOST || 'localhost');

// Khởi tạo Redis client
const redisClient = new Redis({
    host: redisHost,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
        return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 3,
});

// Log khi kết nối thành công
redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

// Log khi có lỗi
redisClient.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
});

export default redisClient;

