import { createClient } from 'redis';

// Redis Configuration
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD?.trim() || undefined;

console.log('🔧 Redis Config (Cart Service):');
console.log('  - Host:', redisHost);
console.log('  - Port:', redisPort);
console.log('  - Password:', redisPassword ? '***SET***' : 'Not set (no auth)');

const redisConfig: any = {
  socket: {
    host: redisHost,
    port: redisPort,
    connectTimeout: 10000, // 10 seconds
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        console.error('❌ Redis: Max retries reached (10), giving up');
        return new Error('Max retries reached');
      }
      const delay = Math.min(retries * 100, 3000);
      console.log(`⏳ Redis retry ${retries}, waiting ${delay}ms...`);
      return delay;
    },
  },
};

// Chỉ thêm password nếu có giá trị thực sự
if (redisPassword) {
  redisConfig.password = redisPassword;
}

const redisClient = createClient(redisConfig);

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
  console.log('✅ Redis Client Connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis Client Ready for commands');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log('✅ Redis connected successfully');
    } else {
      console.log('ℹ️ Redis already connected');
    }
  } catch (error: any) {
    console.error('❌ Failed to connect to Redis:', error.message);
    console.error('⚠️ Cart service will NOT work without Redis!');
    process.exit(1);
  }
};

export default redisClient;