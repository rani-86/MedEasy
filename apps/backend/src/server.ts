import http from 'http';
import { createApp } from './app';
import { initSocketServer } from './sockets';
import { connectDb, disconnectDb } from './config/db';
import { redisClient, redisSubClient } from './config/redis';
import { env } from './config/env';
import { logger } from './config/logger';

async function main(): Promise<void> {
  await connectDb();

  const app = createApp();
  const httpServer = http.createServer(app);

  initSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Medeasy backend listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(async () => {
      await disconnectDb();
      redisClient.disconnect();
      redisSubClient.disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});