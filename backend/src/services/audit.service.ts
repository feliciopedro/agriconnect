import crypto from 'crypto';
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

export interface AuditIntegrityResult {
  isValid: boolean;
  totalAudited: number;
  violations: Array<{
    logId: string;
    action: string;
    timestamp: Date;
    reason: string;
    expectedHash?: string;
    actualHash?: string;
  }>;
}

export class AuditLogService {
  /**
   * Computes a SHA-256 cryptographic digest for an audit log record.
   */
  public static computeHash(entry: {
    previousHash?: string | null;
    actorId: string;
    actorRole: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: any;
    timestamp?: Date | string;
  }): string {
    const payload = [
      entry.previousHash || 'GENESIS',
      entry.actorId,
      entry.actorRole,
      entry.action,
      entry.targetType || '',
      entry.targetId || '',
      entry.metadata ? JSON.stringify(entry.metadata) : '',
      entry.timestamp ? new Date(entry.timestamp).toISOString() : '',
    ].join('|');

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Logs a new audit entry with cryptographic hash chaining.
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

    // Fetch previous log entry to establish cryptographic hash chain
    let lastLog: { hash: string | null } | null = null;
    if (client && (client as any).auditLog && typeof (client as any).auditLog.findFirst === 'function') {
      lastLog = await (client as any).auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { hash: true },
      });
    } else if (prisma && prisma.auditLog && typeof prisma.auditLog.findFirst === 'function') {
      lastLog = await prisma.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { hash: true },
      });
    }

    const previousHash = lastLog?.hash || 'GENESIS';
    const timestamp = new Date();

    const hash = AuditLogService.computeHash({
      previousHash,
      actorId,
      actorRole: actorRole as string,
      action: data.action,
      targetType,
      targetId,
      metadata,
      timestamp,
    });

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
        previousHash,
        hash,
        timestamp,
      },
    });
  }

  /**
   * Verifies the cryptographic integrity of audit logs across the chain.
   */
  public static async verifyIntegrity(limit: number = 1000): Promise<AuditIntegrityResult> {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'asc' },
      take: limit,
    });

    const violations: AuditIntegrityResult['violations'] = [];
    let priorHash = 'GENESIS';

    for (const log of logs) {
      // 1. Check if chain link to previous record is unbroken
      if (log.previousHash && log.previousHash !== priorHash && priorHash !== 'GENESIS') {
        violations.push({
          logId: log.id,
          action: log.action,
          timestamp: log.timestamp,
          reason: `Chain broken: previousHash (${log.previousHash}) does not match prior record hash (${priorHash})`,
        });
      }

      // 2. Recompute SHA-256 digest to verify data tampering
      if (log.hash) {
        const expectedHash = AuditLogService.computeHash({
          previousHash: log.previousHash,
          actorId: log.actorId,
          actorRole: log.actorRole,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          metadata: log.metadata,
          timestamp: log.timestamp,
        });

        if (log.hash !== expectedHash) {
          violations.push({
            logId: log.id,
            action: log.action,
            timestamp: log.timestamp,
            reason: `Data tampering detected: record hash mismatch`,
            expectedHash,
            actualHash: log.hash,
          });
        }
      }

      if (log.hash) {
        priorHash = log.hash;
      }
    }

    return {
      isValid: violations.length === 0,
      totalAudited: logs.length,
      violations,
    };
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

