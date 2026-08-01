import { randomUUID } from 'crypto';
import { redisClient } from '../../config/redis';

export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  const token = randomUUID();
  const result = await redisClient.set(key, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
}

const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

export async function releaseLock(key: string, token: string | null): Promise<void> {
  if (!token) return;
  await redisClient.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
}