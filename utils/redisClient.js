// redis.js
import Redis from 'ioredis';

import { Logger } from './logger.js';

// Build Redis options and only set password when truly provided
const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true, // Manual connection required
};

const rawPassword = process.env.REDIS_PASSWORD;
const isMeaningfulPassword =
  typeof rawPassword === 'string' &&
  rawPassword.trim() !== '' &&
  rawPassword !== 'undefined' &&
  rawPassword !== 'null';

if (isMeaningfulPassword) {
  // Only include password when Redis is expected to require it
  // Avoids: "This Redis server's `default` user does not require a password, but a password was supplied"
  redisOptions.password = rawPassword;
}

// Initialize Redis with optional environment-based configuration
export const redis = new Redis(redisOptions);

// Redis event listeners
redis.on('connect', () => {
  Logger.success('✅ Connected to Redis');
});

redis.on('error', (err) => {
  Logger.error('❌ Redis connection error:', err.message);
});

redis.on('close', () => {
  Logger.warn('🔴 Redis connection closed');
});

// Explicit connection when using lazyConnect
(async () => {
  try {
    await redis.connect();
    Logger.success('✅ Redis manually connected (lazyConnect)');

    const pong = await redis.ping();
    Logger.success(`✅ Redis ping response: ${pong}`);
  } catch (err) {
    Logger.error('❌ Redis connection or ping failed:', err.message);
  }
})();
