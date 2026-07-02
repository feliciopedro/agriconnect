import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

/**
 * Centralized global error handling middleware.
 * Formats all exceptions (AppError, Zod Validation, standard Errors) into
 * a consistent payload schema.
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let status = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_SERVER_ERROR';

  // Handle custom AppError instances
  if (err instanceof AppError) {
    status = err.status;
    message = err.message;
    code = err.code;
  } 
  // Handle request validation errors from Zod
  else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
  } 
  // Handle native JSON parsing errors from Express
  else if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Invalid JSON payload received';
  }
  // Handle other unexpected server errors
  else {
    console.error('💥 Unhandled Backend Error:', err);
    if (process.env.NODE_ENV === 'development') {
      message = err.message || message;
      code = 'DEVELOPMENT_UNHANDLED_ERROR';
    }
  }

  res.status(status).json({
    error: {
      message,
      code,
    },
  });
};
