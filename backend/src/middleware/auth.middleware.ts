import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { RuntimeConfig } from '../config/runtimeConfig';
import { createError } from '../utils/errors';
import { Role } from '../prisma/generated-client';
import { JWTPayload } from '../types';
import prisma from '../prisma/client';
import { AuditLogService } from '../services/audit.service';

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
    
    if (decoded.impersonatedBy && req.method !== 'GET') {
      throw createError('Write operations are forbidden during impersonation sessions', 'IMPERSONATION_READ_ONLY', 403);
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.code === 'IMPERSONATION_READ_ONLY') {
      throw error;
    }
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

/**
 * Middleware that ensures the requester has SUPERADMIN role.
 */
export const requireSuperAdmin = () => {
  // Reuse requireRole with SUPERADMIN
  return requireRole(Role.SUPERADMIN);
};

/**
 * Middleware that checks if the authenticated user is banned.
 */
export const checkBanned = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw createError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  const ban = await prisma.userBan.findUnique({ where: { userId: req.user.userId } });
  if (ban && ban.isActive) {
    throw createError('User is banned', 'USER_BANNED', 403);
  }
  next();
};

/**
 * Factory middleware that logs an audit action.
 * @param action - Action description (e.g., 'SUPERADMIN_ACCESS')
 * @param targetType - Optional target entity type
 * @param targetId - Optional target entity id
 */
export const auditAction = (action: string, targetType?: string, targetId?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw createError('Authentication required', 'UNAUTHENTICATED', 401);
    }
    await AuditLogService.log({
      actorId: req.user.userId,
      actorRole: req.user.role,
      action,
      targetType,
      targetId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.toString() ?? undefined,
    });
    next();
  };
};

/**
 * Global middleware enforcing maintenance mode if platform_active = false.
 */
export const checkMaintenanceMode = (req: Request, res: Response, next: NextFunction) => {
  const isPlatformActive = RuntimeConfig.getBoolean('platform_active', true);
  if (!isPlatformActive) {
    const isSuperAdminRoute = req.path.startsWith('/api/superadmin') || req.path.startsWith('/superadmin');
    const isHealthRoute = req.path.startsWith('/api/health') || req.path.startsWith('/health');

    let isSuperAdminUser = false;
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
        if (decoded && decoded.role === Role.SUPERADMIN) {
          isSuperAdminUser = true;
        }
      }
    } catch (e) {
      // Ignore token parse failures in check
    }

    if (!isSuperAdminRoute && !isHealthRoute && !isSuperAdminUser) {
      const maintenanceMessage = RuntimeConfig.get(
        'maintenance_message',
        'Platform is currently undergoing scheduled maintenance. Please try again later.'
      );
      throw createError(maintenanceMessage, 'MAINTENANCE_MODE_ACTIVE', 503);
    }
  }
  next();
};
