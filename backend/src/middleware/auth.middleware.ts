import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createError } from '../utils/errors';
import { Role } from '../prisma/generated-client';
import { JWTPayload } from '../types';

// Expand Express Request interface to include the authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authenticates incoming request by validating JWT Bearer token in headers.
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw createError('Access token is missing', 'MISSING_TOKEN', 401);
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    throw createError('Access token is invalid or expired', 'INVALID_TOKEN', 401);
  }
};

/**
 * Authorizes access based on user role parameters.
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw createError('Authentication required', 'UNAUTHENTICATED', 401);
    }
    
    if (!roles.includes(req.user.role)) {
      throw createError('Access forbidden: insufficient permissions', 'FORBIDDEN_ACCESS', 403);
    }
    
    next();
  };
};
