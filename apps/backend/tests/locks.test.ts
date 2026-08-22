import { randomUUID } from 'crypto';
import { acquireLock, releaseLock } from '../src/common/utils/locks';
import { redisClient } from '../src/config/redis';

// Proves the primitive the booking flow's fast path depends on: SET NX is atomic, so of N
// concurrent callers racing for the same key, exactly one gets a token back — not "usually
// one," not "one most of the time," exactly one, every time, because Redis itself serializes
// the command rather than us coordinating it in application code.
describe('acquireLock / releaseLock', () => {
  afterAll(async () => {
    redisClient.disconnect();
  });

  it('lets exactly one of many concurrent callers acquire the same key', async () => {
    const key = `test:lock:${randomUUID()}`;
    const attempts = 20;

    const tokens = await Promise.all(Array.from({ length: attempts }, () => acquireLock(key, 5000)));

    const acquired = tokens.filter((t): t is string => t !== null);
    expect(acquired).toHaveLength(1);

    await releaseLock(key, acquired[0]);
    expect(await redisClient.get(key)).toBeNull();
  });

  it('only releases the lock if the caller actually holds it', async () => {
    const key = `test:lock:${randomUUID()}`;
    const realToken = await acquireLock(key, 5000);
    expect(realToken).not.toBeNull();

    // A caller with the wrong token (e.g. one whose own TTL already expired and is now
    // releasing stale state) must not be able to release someone else's active lock.
    await releaseLock(key, 'not-the-real-token');
    expect(await redisClient.get(key)).not.toBeNull();

    await releaseLock(key, realToken);
    expect(await redisClient.get(key)).toBeNull();
  });
});
