import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),

  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: required('REDIS_URL'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  JWT_REFRESH_EXPIRY_DAYS: Number(process.env.JWT_REFRESH_EXPIRY_DAYS ?? 30),

  OTP_LENGTH: Number(process.env.OTP_LENGTH ?? 6),
  OTP_EXPIRY_SECONDS: Number(process.env.OTP_EXPIRY_SECONDS ?? 300),
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),

  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),

  SMS_PROVIDER_API_KEY: process.env.SMS_PROVIDER_API_KEY ?? '',

  // Returns generated OTPs directly in the API response instead of sending SMS.
  // Independent of NODE_ENV so production hardening (JWT secret length, etc.) still applies —
  // only flip this on for a public demo deployment with no real SMS provider wired up.
  DEMO_MODE: process.env.DEMO_MODE === 'true',
} as const;

if (env.NODE_ENV === 'production') {
  if (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters in production');
  }
}
