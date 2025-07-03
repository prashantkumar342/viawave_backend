import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  // password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true, // Don't connect immediately
});

// Handle connection events
redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redis.on('close', () => {
  console.log('🔴 Redis connection closed');
});

// Test connection
redis.ping().catch(err => {
  console.error('Redis ping failed:', err.message);
});