import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'suresh.p@apex.com' } });
  const secret = authenticator.generateSecret();
  await redis.set(`admin:totp_secret:${admin.id}`, secret);
  const token = authenticator.generate(secret);
  console.log('Admin user id:', admin.id);
  console.log('TOTP secret (keep this to generate more codes later):', secret);
  console.log('Current valid TOTP code (use within ~30s):', token);
}

main().finally(() => {
  prisma.$disconnect();
  redis.disconnect();
});