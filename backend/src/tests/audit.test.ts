/**
 * Unit tests for compliance, immutable audit logging, and transactional hooks.
 * Covers: Listing, Order, Delivery, and PreOrder mutations logging.
 */

// Mock Prisma client
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    auditLog: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    produceListing: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    deliveryRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    preOrder: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    traceEvent: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    userBan: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    systemConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    transportProfile: {
      update: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((cb) => cb(prisma)),
    $disconnect: jest.fn(),
  },
}));

import prisma from '../prisma/client';
import { ListingService } from '../services/listing.service';
import { OrderService } from '../services/order.service';
import { DeliveryService } from '../services/delivery.service';
import { PreOrderService } from '../services/preorder.service';
import { AuditLogService } from '../services/audit.service';
import { requireSuperAdmin, checkBanned } from '../middleware/auth.middleware';
import { ListingStatus, OrderStatus, DeliveryStatus, PreOrderStatus, CropType, Role } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuditLogService', () => {
  it('creates log database rows with cryptographic hash chaining via log() method', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-01', role: 'FARMER' });
    (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

    await AuditLogService.log({
      userId: 'user-01',
      action: 'TEST',
      entityName: 'TestEntity',
      entityId: 'id-01',
      oldValues: { status: 'OLD' },
      newValues: { status: 'NEW' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'user-01',
        actorRole: 'FARMER',
        action: 'TEST',
        targetType: 'TestEntity',
        targetId: 'id-01',
        metadata: { oldValues: { status: 'OLD' }, newValues: { status: 'NEW' } },
        previousHash: 'GENESIS',
        hash: expect.any(String),
      }),
    });
  });

  it('verifies cryptographic log integrity and detects unbroken chains', async () => {
    const timestamp = new Date('2026-07-20T10:00:00Z');
    const hash1 = AuditLogService.computeHash({
      previousHash: 'GENESIS',
      actorId: 'user-01',
      actorRole: 'ADMIN',
      action: 'CREATE_USER',
      timestamp,
    });

    const hash2 = AuditLogService.computeHash({
      previousHash: hash1,
      actorId: 'user-01',
      actorRole: 'ADMIN',
      action: 'UPDATE_CONFIG',
      timestamp,
    });

    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'log-1',
        actorId: 'user-01',
        actorRole: 'ADMIN',
        action: 'CREATE_USER',
        targetType: null,
        targetId: null,
        metadata: null,
        previousHash: 'GENESIS',
        hash: hash1,
        timestamp,
      },
      {
        id: 'log-2',
        actorId: 'user-01',
        actorRole: 'ADMIN',
        action: 'UPDATE_CONFIG',
        targetType: null,
        targetId: null,
        metadata: null,
        previousHash: hash1,
        hash: hash2,
        timestamp,
      },
    ]);

    const result = await AuditLogService.verifyIntegrity();
    expect(result.isValid).toBe(true);
    expect(result.totalAudited).toBe(2);
    expect(result.violations.length).toBe(0);
  });

  it('detects record hash mismatches (tamper detection)', async () => {
    const timestamp = new Date('2026-07-20T10:00:00Z');

    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'log-1',
        actorId: 'user-01',
        actorRole: 'ADMIN',
        action: 'TAMPERED_ACTION',
        targetType: null,
        targetId: null,
        metadata: null,
        previousHash: 'GENESIS',
        hash: 'invalid-tampered-sha256-hash',
        timestamp,
      },
    ]);

    const result = await AuditLogService.verifyIntegrity();
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].reason).toContain('Data tampering detected');
  });

  it('retrieves logs with pagination and filters in getLogs()', async () => {
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      { id: 'log-01', action: 'UPDATE' },
    ]);
    (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

    const result = await AuditLogService.getLogs(
      { action: 'UPDATE' },
      { limit: 10, page: 1 }
    );

    expect(prisma.auditLog.findMany).toHaveBeenCalled();
    expect(result.pagination.total).toBe(1);
    expect(result.logs.length).toBe(1);
  });
});

describe('Centralized Hooks Integration Tests', () => {
  describe('Listing Mutations', () => {
    it('logs CREATE when a listing is added', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'farmer-01', region: 'Eastern' });
      (prisma.produceListing.create as jest.Mock).mockResolvedValue({
        id: 'listing-01',
        cropType: CropType.TOMATO,
        quantityKg: 100,
        pricePerKg: 5,
        status: ListingStatus.AVAILABLE,
      });

      await ListingService.createListing(
        'farmer-01',
        { cropType: CropType.TOMATO, quantityKg: 100, pricePerKg: 5 },
        []
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE',
            targetType: 'ProduceListing',
            targetId: 'listing-01',
          }),
        })
      );
    });

    it('logs UPDATE when a listing is updated', async () => {
      (prisma.produceListing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-01',
        farmerId: 'farmer-01',
        quantityKg: 100,
        remainingKg: 100,
        pricePerKg: 5,
        status: ListingStatus.AVAILABLE,
      });

      (prisma.produceListing.update as jest.Mock).mockResolvedValue({
        id: 'listing-01',
        quantityKg: 150,
        remainingKg: 150,
        pricePerKg: 5,
        status: ListingStatus.AVAILABLE,
      });

      await ListingService.updateListing('listing-01', 'farmer-01', { quantityKg: 150 });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE',
            targetType: 'ProduceListing',
            targetId: 'listing-01',
          }),
        })
      );
    });
  });

  describe('Order Mutations', () => {
    it('logs CREATE when an order is created', async () => {
      (prisma.produceListing.findUnique as jest.Mock).mockResolvedValue({
        id: 'listing-01',
        pricePerKg: 5.0,
        status: ListingStatus.AVAILABLE,
      });
      (prisma.produceListing.update as jest.Mock).mockResolvedValue({
        id: 'listing-01',
        remainingKg: 50,
      });
      (prisma.order.create as jest.Mock).mockResolvedValue({
        id: 'order-01',
        buyerId: 'buyer-01',
        listingId: 'listing-01',
        quantityKg: 10,
        totalPrice: 50,
        status: OrderStatus.PENDING,
        paymentStatus: 'UNPAID',
      });

      await OrderService.createOrder('buyer-01', 'listing-01', 10);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE',
            targetType: 'Order',
            targetId: 'order-01',
          }),
        })
      );
    });

    it('logs CANCEL when an order is cancelled', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-01',
        buyerId: 'buyer-01',
        listingId: 'listing-01',
        quantityKg: 10,
        status: OrderStatus.PENDING,
        listing: { remainingKg: 50 },
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: 'order-01',
        status: OrderStatus.CANCELLED,
      });

      await OrderService.cancelOrder('order-01', 'buyer-01');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CANCEL',
            targetType: 'Order',
            targetId: 'order-01',
          }),
        })
      );
    });
  });

  describe('Delivery Mutations', () => {
    it('logs MATCH when transporter accepts delivery', async () => {
      (prisma.deliveryRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'delivery-01',
        routeGroupId: null,
        status: DeliveryStatus.REQUESTED,
      });
      (prisma.deliveryRequest.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'delivery-01',
          order: { listingId: 'listing-01', listing: { farmerId: 'farmer-01', cropType: CropType.TOMATO } },
        },
      ]);

      await DeliveryService.acceptDeliveryRequest('delivery-01', 'transporter-01');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'MATCH',
            targetType: 'DeliveryRequest',
            targetId: 'delivery-01',
          }),
        })
      );
    });

    it('logs PICKUP when transporter updates status to PICKED_UP', async () => {
      (prisma.deliveryRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'delivery-01',
        transportProviderId: 'transporter-01',
        status: DeliveryStatus.MATCHED,
        order: { buyerId: 'buyer-01', listingId: 'listing-01' },
      });
      (prisma.deliveryRequest.update as jest.Mock).mockResolvedValue({
        id: 'delivery-01',
        status: DeliveryStatus.PICKED_UP,
      });

      await DeliveryService.updateDeliveryStatus(
        'delivery-01',
        DeliveryStatus.PICKED_UP,
        'transporter-01'
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PICKUP',
            targetType: 'DeliveryRequest',
            targetId: 'delivery-01',
          }),
        })
      );
    });
  });
});

describe('SuperAdmin Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1',
    };
    res = {};
    next = jest.fn();
  });

  describe('requireSuperAdmin', () => {
    it('allows access for SUPERADMIN users', () => {
      req.user = { userId: 'sa-01', role: Role.SUPERADMIN };
      const middleware = requireSuperAdmin();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('throws forbidden for non-SUPERADMIN users', () => {
      req.user = { userId: 'user-01', role: Role.ADMIN };
      const middleware = requireSuperAdmin();
      expect(() => middleware(req, res, next)).toThrow();
    });
  });

  describe('checkBanned', () => {
    it('allows access for non-banned users', async () => {
      req.user = { userId: 'user-01', role: Role.FARMER };
      (prisma.userBan.findUnique as jest.Mock).mockResolvedValue(null);

      await checkBanned(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('throws forbidden for banned active users', async () => {
      req.user = { userId: 'user-01', role: Role.FARMER };
      (prisma.userBan.findUnique as jest.Mock).mockResolvedValue({ isActive: true });

      await expect(checkBanned(req, res, next)).rejects.toThrow();
    });
  });
});
