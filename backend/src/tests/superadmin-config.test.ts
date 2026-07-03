jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    systemConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

import prisma from '../prisma/client';
import { SuperAdminConfigService } from '../services/superadmin/config.service';
import { RuntimeConfig } from '../config/runtimeConfig';
import { Role } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SuperAdminConfigService', () => {
  describe('getAllConfig', () => {
    it('returns system configs mapped to a key-value record', async () => {
      (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([
        { key: 'platform_fee_percent', value: '3.8' },
        { key: 'delivery_base_fee_ghs', value: '18' },
      ]);

      const result = await SuperAdminConfigService.getAllConfig();

      expect(result.platform_fee_percent).toBe('3.8');
      expect(result.delivery_base_fee_ghs).toBe('18');
    });
  });

  describe('updateConfig', () => {
    it('updates a config, reloads runtime cache, and logs details', async () => {
      (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue({ key: 'platform_fee_percent', value: '3.5' });
      (prisma.systemConfig.upsert as jest.Mock).mockResolvedValue({ id: 'conf-1', key: 'platform_fee_percent', value: '4.0' });

      // Mock findMany for RuntimeConfig reload
      (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([
        { key: 'platform_fee_percent', value: '4.0' },
      ]);

      const updated = await SuperAdminConfigService.updateConfig('sa-1', 'platform_fee_percent', '4.0');

      expect(updated.value).toBe('4.0');
      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'platform_fee_percent' },
        create: { key: 'platform_fee_percent', value: '4.0', updatedBy: 'sa-1' },
        update: { value: '4.0', updatedBy: 'sa-1' },
      });

      // Verify RuntimeConfig reloaded
      expect(RuntimeConfig.getNumber('platform_fee_percent', 3.5)).toBe(4.0);
    });

    it('rejects unallowed or custom keys', async () => {
      await expect(
        SuperAdminConfigService.updateConfig('sa-1', 'non_existing_random_key_123', 'value')
      ).rejects.toThrow();
    });
  });

  describe('toggleMaintenanceMode', () => {
    it('updates platform status and message', async () => {
      (prisma.systemConfig.upsert as jest.Mock).mockResolvedValue({ id: 'active-status' });
      (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([
        { key: 'platform_active', value: 'false' },
        { key: 'maintenance_message', value: 'System upgrade in progress' },
      ]);

      const result = await SuperAdminConfigService.toggleMaintenanceMode('sa-1', true, 'System upgrade in progress');

      expect(result.active).toBe(true);
      expect(result.message).toBe('System upgrade in progress');

      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'platform_active' },
        create: { key: 'platform_active', value: 'false', updatedBy: 'sa-1' },
        update: { value: 'false', updatedBy: 'sa-1' },
      });

      // Verify RuntimeConfig status
      expect(RuntimeConfig.getBoolean('platform_active', true)).toBe(false);
      expect(RuntimeConfig.get('maintenance_message', '')).toBe('System upgrade in progress');
    });
  });

  describe('broadcastNotification', () => {
    it('returns dry run metrics if confirm is omitted for SMS', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'u1', phone: '123' },
        { id: 'u2', phone: '456' },
      ]);

      const result = await SuperAdminConfigService.broadcastNotification(
        'sa-1',
        [Role.FARMER, Role.BUYER],
        'Hello users',
        true,
        false
      );

      expect(result.recipientCount).toBe(2);
      expect(result.smsSentCount).toBe(0);
      expect(result.dryRun).toBe(true);

      // Notification records should NOT be created during dry run
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('creates notifications and fires SMS in bulk when confirm is true', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'u1', phone: '123' },
        { id: 'u2', phone: '456' },
      ]);

      const result = await SuperAdminConfigService.broadcastNotification(
        'sa-1',
        [Role.FARMER, Role.BUYER],
        'Hello users',
        true,
        true
      );

      expect(result.recipientCount).toBe(2);
      expect(result.smsSentCount).toBe(2);
      expect(result.dryRun).toBe(false);

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', type: 'BROADCAST', message: 'Hello users', isRead: false },
          { userId: 'u2', type: 'BROADCAST', message: 'Hello users', isRead: false },
        ],
      });
    });
  });
});
