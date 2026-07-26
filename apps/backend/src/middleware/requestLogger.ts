import pinoHttp from 'pino-http';
import { Request } from 'express';
import { logger } from '../config/logger';

export const requestLogger = pinoHttp({
  logger,
  autoLogging: true,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // pino-http types `req` as Node's raw IncomingMessage. At runtime it's always the
  // same Express Request object (Express extends IncomingMessage), so this cast is
  // safe — it's needed purely because our `req.user` augmentation is declared on
  // Express.Request, which pino-http's own types don't know about.
  customProps: (req) => {
    const expressReq = req as Request;
    return { userId: expressReq.user?.sub, role: expressReq.user?.role };
  },
});