import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

// Singleton Prisma client — avoids exhausting the Postgres connection pool
// under hot-reload in dev and across repeated imports.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  logger.info('Connected to PostgreSQL via Prisma');
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
