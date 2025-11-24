import Redis from 'ioredis';

// Auto-detect: Nếu REDIS_HOST là 'redis' (Docker) và đang ở test/dev local, dùng localhost
const isDockerHost = process.env.REDIS_HOST === 'redis';
const redisHost = (isDockerHost && process.env.NODE_ENV === 'test')
    ? 'localhost'
    : (process.env.REDIS_HOST || 'localhost');

const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD?.trim() || undefined;
const redisDb = parseInt(process.env.REDIS_DB || '0');

console.log('🔧 Redis Config (Drone Service):');
console.log('  - Host:', redisHost);
console.log('  - Port:', redisPort);
console.log('  - Password:', redisPassword ? '***SET***' : 'Not set (no auth)');
console.log('  - DB:', redisDb);

// Khởi tạo Redis client
const redis = new Redis({
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
redis.on('connect', () => {
    console.log('✅ Redis connected successfully (Drone Service)');
});

// Log khi ready (authenticated)
redis.on('ready', () => {
    console.log('✅ Redis ready for commands (Drone Service)');
});

// Log khi có lỗi
redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
});

// Log khi reconnecting
redis.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
});

// OTP utility functions
const OTP_TTL = 30; // 30 seconds

export const otpRedis = {
  // Generate and store OTP for delivery
  async generateOtp(deliveryId: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `pickup_otp:${deliveryId}`;

    await redis.setex(key, OTP_TTL, otp);
    console.log(`🔐 Generated OTP for delivery ${deliveryId}, expires in ${OTP_TTL}s`);

    return otp;
  },

  // Get OTP for delivery
  async getOtp(deliveryId: string): Promise<string | null> {
    const key = `pickup_otp:${deliveryId}`;
    return await redis.get(key);
  },

  // Verify OTP
  async verifyOtp(deliveryId: string, otp: string): Promise<boolean> {
    const storedOtp = await this.getOtp(deliveryId);

    if (!storedOtp) {
      console.log(`❌ No OTP found for delivery ${deliveryId}`);
      return false;
    }

    if (storedOtp !== otp) {
      console.log(`❌ Invalid OTP for delivery ${deliveryId}`);
      return false;
    }

    console.log(`✅ Valid OTP for delivery ${deliveryId}`);
    return true;
  },

  // Delete OTP after verification
  async deleteOtp(deliveryId: string): Promise<void> {
    const key = `pickup_otp:${deliveryId}`;
    await redis.del(key);
    console.log(`🗑️ Deleted OTP for delivery ${deliveryId}`);
  },

  // Get TTL for OTP
  async getOtpTtl(deliveryId: string): Promise<number> {
    const key = `pickup_otp:${deliveryId}`;
    return await redis.ttl(key);
  }
};

// Drone location tracking (lưu vị trí hiện tại trong Redis)
export const droneLocationRedis = {
  // Save current drone location
  async setDroneLocation(droneId: string, lat: number, lng: number): Promise<void> {
    const key = `drone_location:${droneId}`;
    const data = JSON.stringify({ lat, lng, timestamp: Date.now() });

    // Set with TTL 1 hour (tự động xóa nếu drone offline)
    await redis.setex(key, 3600, data);
  },

  // Get current drone location from Redis
  async getDroneLocation(droneId: string): Promise<{ lat: number; lng: number } | null> {
    const key = `drone_location:${droneId}`;
    const data = await redis.get(key);

    if (!data) return null;

    const parsed = JSON.parse(data);
    return { lat: parsed.lat, lng: parsed.lng };
  },

  // Delete drone location (khi drone về home base)
  async deleteDroneLocation(droneId: string): Promise<void> {
    const key = `drone_location:${droneId}`;
    await redis.del(key);
  },

  // Save route progress (để track drone đang ở đâu trên route)
  async setRouteProgress(deliveryId: string, progress: number): Promise<void> {
    const key = `route_progress:${deliveryId}`;
    await redis.setex(key, 3600, progress.toString());
  },

  async getRouteProgress(deliveryId: string): Promise<number> {
    const key = `route_progress:${deliveryId}`;
    const progress = await redis.get(key);
    return progress ? parseFloat(progress) : 0;
  }
};

export default redis;

