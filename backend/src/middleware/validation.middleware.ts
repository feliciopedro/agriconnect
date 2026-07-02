import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Reusable input validation middleware checking request body against a Zod schema.
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and cast request body
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};
