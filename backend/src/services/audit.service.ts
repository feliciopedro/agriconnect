import prisma from '../prisma/client';
import { Prisma } from '../prisma/generated-client';

export interface AuditLogData {
  userId?: string | null;
  action: string;
  entityName: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
}

export class AuditLogService {
  /**
   * Logs a new data mutation to the immutable AuditLog table.
   * Can be executed within a transaction block by passing the transaction client.
   */
  public static async log(
    data: AuditLogData,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;
    await client.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        entityName: data.entityName,
        entityId: data.entityId,
        oldValues: data.oldValues ? (data.oldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: data.newValues ? (data.newValues as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  /**
   * Retrieves audit logs for admin review with filtering and pagination.
   */
  public static async getLogs(
    filters: {
      userId?: string;
      action?: string;
      entityName?: string;
      entityId?: string;
    },
    pagination: {
      limit: number;
      page: number;
    }
  ) {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityName) where.entityName = filters.entityName;
    if (filters.entityId) where.entityId = filters.entityId;

    const skip = (pagination.page - 1) * pagination.limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit,
        include: {
          user: {
            select: { id: true, name: true, phone: true, role: true },
          },
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
