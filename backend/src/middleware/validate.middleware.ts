import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Reusable validation middleware that checks request parameters, body, or queries against a Zod schema.
 * Returns 400 with detailed field-level error messages upon schema mismatch.
 */
export const validate = (schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fields = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      res.status(400).json({
        error: {
          message: 'Validation failed',
          fields,
        },
      });
      return;
    }

    // Assign parsed and typed data back to request
    req[target] = result.data;
    next();
  };
};
