import Redis from 'ioredis';

// Auto-detect: Nếu REDIS_HOST là 'redis' (Docker) và đang ở test/dev local, dùng localhost
const isDockerHost = process.env.REDIS_HOST === 'redis';
const redisHost = (isDockerHost && process.env.NODE_ENV === 'test')
    ? 'localhost'
    : (process.env.REDIS_HOST || 'localhost');

const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD?.trim() || undefined;
const redisDb = parseInt(process.env.REDIS_DB || '0');

console.log('🔧 Redis Config:');
console.log('  - Host:', redisHost);
console.log('  - Port:', redisPort);
console.log('  - Password:', redisPassword ? '***SET***' : 'Not set (no auth)');
console.log('  - DB:', redisDb);

// Khởi t��o Redis client
const redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    db: redisDb,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`⏳ Redis retry ${times}, waiting ${delay}ms...`);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    lazyConnect: false,
});

// Log khi kết nối thành công
redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully');
});

// Log khi ready (authenticated)
redisClient.on('ready', () => {
    console.log('✅ Redis ready for commands');
});

// Log khi có lỗi
redisClient.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
});

// Log khi reconnecting
redisClient.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
});

export default redisClient;

