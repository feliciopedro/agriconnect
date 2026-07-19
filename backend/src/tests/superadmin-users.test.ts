jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userBan: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    produceListing: {
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    deliveryRequest: {
      findMany: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
    ussdShortMessage: {
      create: jest.fn().mockResolvedValue({ id: 'sms-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

import prisma from '../prisma/client';
import { SuperAdminUserManagementService } from '../services/superadmin/userManagement.service';
import { Role, ListingStatus, OrderStatus, DeliveryStatus } from '../prisma/generated-client';
import jwt from 'jsonwebtoken';
import { config } from '../config';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SuperAdminUserManagementService', () => {
  describe('getAllUsers', () => {
    it('returns users with mapped profiles and calculated statistics', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'user-farmer',
          phone: '+233241234567',
          name: 'Farmer John',
          role: Role.FARMER,
          isVerified: true,
          createdAt: new Date(),
          region: 'Eastern',
          district: 'Suhum',
          ban: null,
          listings: [
            {
              id: 'listing-1',
              quantityKg: 100,
              orders: [{ quantityKg: 50 }],
            },
          ],
        },
        {
          id: 'user-buyer',
          phone: '+233242234567',
          name: 'Buyer Grace',
          role: Role.BUYER,
          isVerified: false,
          createdAt: new Date(),
          region: 'Greater Accra',
          district: 'Accra',
          ban: { isActive: true, reason: 'Late payment' },
          orders: [
            { totalPrice: 300 },
          ],
        },
      ]);

      const result = await SuperAdminUserManagementService.getAllUsers({}, {});

      expect(result.users.length).toBe(2);

      const farmer = result.users.find((u) => u.id === 'user-farmer')!;
      expect(farmer.stats.listingCount).toBe(1);
      expect(farmer.stats.totalKgSold).toBe(50);
      expect(farmer.isBanned).toBe(false);

      const buyer = result.users.find((u) => u.id === 'user-buyer')!;
      expect(buyer.stats.orderCount).toBe(1);
      expect(buyer.stats.totalSpend).toBe(300);
      expect(buyer.isBanned).toBe(true);
      expect(buyer.banReason).toBe('Late payment');
    });

    it('filters users by search and verified criteria', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'u1', name: 'John Doe', phone: '123', role: Role.FARMER, listings: [], orders: [], deliveries: [] },
        { id: 'u2', name: 'Jane Smith', phone: '456', role: Role.BUYER, listings: [], orders: [], deliveries: [] },
      ]);

      const result = await SuperAdminUserManagementService.getAllUsers({ search: 'Jane' }, {});
      expect(result.users.length).toBe(1);
      expect(result.users[0].name).toBe('Jane Smith');
    });
  });

  describe('getUserDetail', () => {
    it('returns full profile and historical lists for user detail view', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        name: 'John Doe',
        role: Role.FARMER,
        ban: null,
      });

      (prisma.produceListing.findMany as jest.Mock).mockResolvedValue([{ id: 'l1' }]);
      (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([{ id: 'log-1', action: 'CREATE' }]);

      const result = await SuperAdminUserManagementService.getUserDetail('u1');

      expect(result.user.name).toBe('John Doe');
      expect(result.activities.listings.length).toBe(1);
      expect(result.auditLogs.length).toBe(1);
    });
  });

  describe('banUser', () => {
    it('updates ban status and notifies user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: Role.FARMER });
      (prisma.userBan.upsert as jest.Mock).mockResolvedValue({ id: 'ban-1', isActive: true });

      const ban = await SuperAdminUserManagementService.banUser('sa-1', 'u1', 'TOS violation');

      expect(ban.isActive).toBe(true);
      expect(prisma.userBan.upsert).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('prevents banning a SUPERADMIN', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: Role.SUPERADMIN });

      await expect(
        SuperAdminUserManagementService.banUser('sa-1', 'u1', 'Tos violation')
      ).rejects.toThrow();
    });
  });

  describe('unbanUser', () => {
    it('deactivates suspension and logs audit', async () => {
      (prisma.userBan.findUnique as jest.Mock).mockResolvedValue({ id: 'ban-1', isActive: true, reason: 'Test' });
      (prisma.userBan.update as jest.Mock).mockResolvedValue({ id: 'ban-1', isActive: false });

      const result = await SuperAdminUserManagementService.unbanUser('sa-1', 'u1');

      expect(result.isActive).toBe(false);
      expect(prisma.userBan.update).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('promoteToAdmin', () => {
    it('promotes user role to ADMIN', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: Role.FARMER });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', role: Role.ADMIN });

      const result = await SuperAdminUserManagementService.promoteToAdmin('sa-1', 'u1');

      expect(result.role).toBe(Role.ADMIN);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: Role.ADMIN },
      });
    });
  });

  describe('demoteAdmin', () => {
    it('demotes admin back to farmer if profile exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        role: Role.ADMIN,
        farmerProfile: {},
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', role: Role.FARMER });

      const result = await SuperAdminUserManagementService.demoteAdmin('sa-1', 'u1');

      expect(result.role).toBe(Role.FARMER);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: Role.FARMER },
      });
    });
  });

  describe('forceVerifyUser', () => {
    it('sets isVerified to true and dispatches SMS notification', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        name: 'Verified User',
        phone: '+233241234567',
        isVerified: false,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', isVerified: true });

      const result = await SuperAdminUserManagementService.forceVerifyUser('sa-1', 'u1');

      expect(result.isVerified).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isVerified: true },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          type: 'ACCOUNT_VERIFIED',
        }),
      });
      expect(prisma.ussdShortMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          toPhone: '+233241234567',
          triggerAction: 'account_verified',
        }),
      });
    });
  });

  describe('impersonateUser', () => {
    it('signs and returns read-only impersonation token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', role: Role.BUYER });

      const result = await SuperAdminUserManagementService.impersonateUser('sa-1', 'u1');

      expect(result.impersonationToken).toBeDefined();
      const decoded = jwt.verify(result.impersonationToken, config.JWT_SECRET) as any;
      expect(decoded.userId).toBe('u1');
      expect(decoded.role).toBe(Role.BUYER);
      expect(decoded.impersonatedBy).toBe('sa-1');
    });
  });
});
