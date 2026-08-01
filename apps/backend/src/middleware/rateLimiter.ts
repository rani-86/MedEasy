import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { TooManyRequestsError } from '../common/errors';

function redisStore(prefix: string) {
  return new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: (...args: string[]): Promise<any> => redisClient.call(...(args as [string, ...string[]])),
    prefix,
  });
}

// General API rate limit — applied globally in app.ts
export const apiRateLimiter = rateLimit({
  store: redisStore('rl:api:'),
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new TooManyRequestsError()),
});

// Tighter limit on OTP request endpoint — prevents SMS-bombing abuse
export const otpRequestRateLimiter = rateLimit({
  store: redisStore('rl:otp-request:'),
  windowMs: 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone ?? req.ip,
  handler: (_req, _res, next) =>
    next(new TooManyRequestsError('Too many OTP requests for this number. Please wait before retrying.')),
});

// Limit on OTP verify — prevents brute-forcing a 6-digit code
export const otpVerifyRateLimiter = rateLimit({
  store: redisStore('rl:otp-verify:'),
  windowMs: 10 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone ?? req.ip,
  handler: (_req, _res, next) =>
    next(new TooManyRequestsError('Too many verification attempts. Please request a new OTP.')),
});

// Login endpoint — slow down credential-stuffing attempts
export const loginRateLimiter = rateLimit({
  store: redisStore('rl:login:'),
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.body?.email ?? 'unknown'}:${req.ip}`,
  handler: (_req, _res, next) => next(new TooManyRequestsError('Too many login attempts. Please try again later.')),
});

// Booking-mutation endpoints — keyed by patient (authenticated user), not IP, since
// a hospital waiting room's shared WiFi would otherwise trip a per-IP limit for
// every legitimate patient booking at once.


// Booking-mutation endpoints — keyed by patient (authenticated user), not IP, since
// a hospital waiting room's shared WiFi would otherwise trip a per-IP limit for
// every legitimate patient booking at once.
export const bookingRateLimiter = rateLimit({
  store: redisStore('rl:booking:'),
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? 'unknown',
  handler: (_req, _res, next) =>
    next(new TooManyRequestsError('Too many booking attempts. Please wait a moment and try again.')),
});
