import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
}

export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user?.scopes?.includes(scope)) {
      return next(new ForbiddenError(`Missing required scope: ${scope}`));
    }
    next();
  };
}
