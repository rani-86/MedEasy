import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../common/errors';

export function validateRequest(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
      // Overwrite with parsed/coerced values (e.g. trimmed strings, defaulted fields)
      if (parsed.body) req.body = parsed.body;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new ValidationError(
            err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          ),
        );
      }
      next(err);
    }
  };
}
