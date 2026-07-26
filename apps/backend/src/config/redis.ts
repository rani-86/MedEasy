import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 200, 2000),
});

redisClient.on('connect', () => logger.info('Connected to Redis'));
redisClient.on('error', (err: Error) => logger.error({ err }, 'Redis connection error'));
