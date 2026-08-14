import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient, redisSubClient } from '../config/redis';
import { env } from '../config/env';
import { registerBedsNamespace } from './beds.namespace';
import { registerQueueNamespace } from './queue.namespace';
import { setSocketServer } from './socketRegistry';

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.ALLOWED_ORIGINS, credentials: true },
    adapter: createAdapter(redisClient, redisSubClient),
  });

  registerBedsNamespace(io);
  registerQueueNamespace(io);
  setSocketServer(io);

  return io;
}