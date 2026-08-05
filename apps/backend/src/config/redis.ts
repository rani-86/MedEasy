import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
});



redisClient.on('connect', () => logger.info('Connected to Redis'));
redisClient.on('error', (err: Error) => logger.error({ err }, 'Redis connection error'));

// enableReadyCheck: false is required here — ioredis normally runs an INFO command
// right after connecting to verify the server is ready, but the Redis adapter puts
// this connection into subscriber-only mode almost immediately, and subscriber
// connections can't run INFO. Without this flag you'll see:
// "Connection in subscriber mode, only subscriber commands may be used"
export const redisSubClient = redisClient.duplicate({ enableReadyCheck: false });

redisSubClient.on('error', (err: Error) => logger.error({ err }, 'Redis (sub) connection error'));