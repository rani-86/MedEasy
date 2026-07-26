import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors';
import { logger } from '../config/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, 'Application error');
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'DUPLICATE_ENTRY', message: 'A record with this value already exists' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found' } });
      return;
    }
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong. Please try again.' },
  });
}
