jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import prisma from '../prisma/client';
import { SuperAdminAuditService } from '../services/superadmin/audit.service';
import { Role } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SuperAdminAuditService', () => {
  describe('getAuditLogs', () => {
    it('returns filtered and paginated audit logs with joined actor profiles', async () => {
      const mockLog = {
        id: 'log-1',
        actorId: 'u1',
        action: 'USER_BANNED',
        targetType: 'User',
        targetId: 'u2',
        timestamp: new Date(),
        actor: { name: 'Super Admin', role: Role.SUPERADMIN },
      };

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([mockLog]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await SuperAdminAuditService.getAuditLogs(
        { action: 'USER_BANNED', targetType: 'User' },
        { limit: 50, page: 1 }
      );

      expect(result.logs.length).toBe(1);
      expect(result.logs[0].id).toBe('log-1');
      expect(result.logs[0].actor.name).toBe('Super Admin');
      expect(result.pagination.total).toBe(1);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          action: 'USER_BANNED',
          targetType: 'User',
        },
        include: {
          actor: { select: { name: true, role: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('limits page sizes to a maximum of 500 records', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await SuperAdminAuditService.getAuditLogs({}, { limit: 1000, page: 1 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500,
        })
      );
    });
  });

  describe('getAuditLogsForUser', () => {
    it('queries logs involving target user as actor or target', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      await SuperAdminAuditService.getAuditLogsForUser('user-1');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { actorId: 'user-1' },
            { targetId: 'user-1' },
          ],
        },
        include: {
          actor: { select: { name: true, role: true } },
        },
        orderBy: { timestamp: 'desc' },
      });
    });
  });
});
