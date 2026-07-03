import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { BanUserSchema, UpdateConfigSchema } from '../types/superadmin.schema';
import { AuditLogService } from '../services/audit.service';

export class SuperAdminController {
  /**
   * Ban a user (creates/updates UserBan with target userId).
   */
  public static async banUser(req: Request, res: Response) {
    const { id: targetUserId } = req.params;
    const body = BanUserSchema.parse(req.body);

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (targetUser.role === 'SUPERADMIN') {
      throw createError('Cannot ban a SUPERADMIN', 'FORBIDDEN_ACTION', 403);
    }

    const ban = await prisma.userBan.upsert({
      where: { userId: targetUserId },
      create: {
        userId: targetUserId,
        bannedBy: req.user!.userId,
        reason: body.reason,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        isActive: true,
      },
      update: {
        bannedBy: req.user!.userId,
        reason: body.reason,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        isActive: true,
        bannedAt: new Date(),
      },
    });

    await AuditLogService.log({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'USER_BANNED',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { reason: body.reason, expiresAt: body.expiresAt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.toString(),
    });

    res.json({ message: 'User banned successfully', ban });
  }

  /**
   * Unban a user (deactivates UserBan).
   */
  public static async unbanUser(req: Request, res: Response) {
    const { id: targetUserId } = req.params;

    const ban = await prisma.userBan.findUnique({ where: { userId: targetUserId } });
    if (!ban || !ban.isActive) {
      throw createError('User is not banned or already active', 'BAD_REQUEST', 400);
    }

    const updatedBan = await prisma.userBan.update({
      where: { userId: targetUserId },
      data: { isActive: false },
    });

    await AuditLogService.log({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'USER_UNBANNED',
      targetType: 'User',
      targetId: targetUserId,
      metadata: { previousReason: ban.reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.toString(),
    });

    res.json({ message: 'User unbanned successfully', ban: updatedBan });
  }

  /**
   * Update system configuration key-values.
   */
  public static async updateConfig(req: Request, res: Response) {
    const body = UpdateConfigSchema.parse(req.body);

    const oldConfig = await prisma.systemConfig.findUnique({ where: { key: body.key } });

    const configRecord = await prisma.systemConfig.upsert({
      where: { key: body.key },
      create: {
        key: body.key,
        value: body.value,
        updatedBy: req.user!.userId,
      },
      update: {
        value: body.value,
        updatedBy: req.user!.userId,
      },
    });

    await AuditLogService.log({
      actorId: req.user!.userId,
      actorRole: req.user!.role,
      action: 'CONFIG_UPDATED',
      targetType: 'SystemConfig',
      targetId: configRecord.id,
      metadata: {
        key: body.key,
        oldValue: oldConfig ? oldConfig.value : null,
        newValue: body.value,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']?.toString(),
    });

    res.json({ message: 'Configuration updated successfully', config: configRecord });
  }

  /**
   * View all audit logs (paginated).
   */
  public static async getAuditLogs(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await AuditLogService.getLogs({}, { page, limit });
    res.json(result);
  }

  /**
   * View platform status and configurations.
   */
  public static async getStatus(req: Request, res: Response) {
    const configs = await prisma.systemConfig.findMany();
    res.json({
      status: 'ok',
      timestamp: new Date(),
      configs,
    });
  }
}
