import prisma from '../../prisma/client';

export class SuperAdminAuditService {
  /**
   * Retrieves all platform audit logs with dynamic filtering, sorting, and pagination.
   */
  public static async getAuditLogs(
    filters: {
      actorId?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      startDate?: string;
      endDate?: string;
    },
    pagination: {
      limit?: number;
      page?: number;
    }
  ) {
    const limit = Math.min(pagination.limit || 50, 500);
    const page = pagination.page || 1;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.targetType) {
      where.targetType = filters.targetType;
    }
    if (filters.targetId) {
      where.targetId = filters.targetId;
    }
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.timestamp.lte = new Date(filters.endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { name: true, role: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves all audit logs affecting or initiated by a specific user.
   */
  public static async getAuditLogsForUser(userId: string) {
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { actorId: userId },
          { targetId: userId },
        ],
      },
      include: {
        actor: { select: { name: true, role: true } },
      },
      orderBy: { timestamp: 'desc' },
    });

    return logs;
  }
}
