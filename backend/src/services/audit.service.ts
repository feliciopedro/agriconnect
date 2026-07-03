import prisma from '../prisma/client';
import { Prisma, Role } from '../prisma/generated-client';

export interface AuditLogData {
  actorId?: string;
  userId?: string | null; // Old field compatibility
  actorRole?: string;     // Role enum as string
  action: string;
  targetType?: string;
  entityName?: string;    // Old field compatibility
  targetId?: string;
  entityId?: string;      // Old field compatibility
  metadata?: any;
  oldValues?: any;        // Old field compatibility
  newValues?: any;        // Old field compatibility
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogService {
  /**
   * Logs a new audit entry.
   * Can be executed within a transaction block by passing the transaction client.
   */
  public static async log(
    data: AuditLogData,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;

    const actorId = data.actorId || data.userId;
    if (!actorId) {
      throw new Error('actorId or userId is required for audit logging');
    }

    let actorRole = data.actorRole;
    if (!actorRole) {
      // Query the user's role if not explicitly provided
      let user = null;
      if (client && (client as any).user) {
        user = await (client as any).user.findUnique({
          where: { id: actorId },
          select: { role: true },
        });
      } else if (prisma && prisma.user) {
        user = await prisma.user.findUnique({
          where: { id: actorId },
          select: { role: true },
        });
      }
      actorRole = user?.role || Role.ADMIN;
    }

    const targetType = data.targetType || data.entityName || null;
    const targetId = data.targetId || data.entityId || null;

    let metadata = data.metadata;
    if (!metadata && (data.oldValues || data.newValues)) {
      metadata = {
        oldValues: data.oldValues ?? null,
        newValues: data.newValues ?? null,
      };
    }

    await client.auditLog.create({
      data: {
        actorId,
        actorRole: actorRole as Role,
        action: data.action,
        targetType,
        targetId,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  /**
   * Retrieves audit logs with optional filtering and pagination.
   */
  public static async getLogs(
    filters: {
      actorId?: string;
      userId?: string; // Old filter compatibility
      actorRole?: string;
      action?: string;
      targetType?: string;
      entityName?: string; // Old filter compatibility
      targetId?: string;
      entityId?: string;   // Old filter compatibility
    },
    pagination: { limit: number; page: number }
  ) {
    const where: any = {};
    const actorId = filters.actorId || filters.userId;
    if (actorId) where.actorId = actorId;
    if (filters.actorRole) where.actorRole = filters.actorRole;
    if (filters.action) where.action = filters.action;

    const targetType = filters.targetType || filters.entityName;
    if (targetType) where.targetType = targetType;

    const targetId = filters.targetId || filters.entityId;
    if (targetId) where.targetId = targetId;

    const skip = (pagination.page - 1) * pagination.limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pagination.limit,
        include: {
          actor: { select: { id: true, name: true, phone: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }
}
