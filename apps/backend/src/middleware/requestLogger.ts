import pinoHttp from 'pino-http';
import { logger } from '../config/logger';

export const requestLogger = pinoHttp({
  logger,
  autoLogging: true,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (req) => ({ userId: req.user?.sub, role: req.user?.role }),
});
