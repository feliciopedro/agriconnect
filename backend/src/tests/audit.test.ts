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
import { ListingStatus, OrderStatus, DeliveryStatus, PreOrderStatus, CropType } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AuditLogService', () => {
  it('creates log database rows via log() method', async () => {
    await AuditLogService.log({
      userId: 'user-01',
      action: 'TEST',
      entityName: 'TestEntity',
      entityId: 'id-01',
      oldValues: { status: 'OLD' },
      newValues: { status: 'NEW' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-01',
        action: 'TEST',
        entityName: 'TestEntity',
        entityId: 'id-01',
        oldValues: { status: 'OLD' },
        newValues: { status: 'NEW' },
      },
    });
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
            entityName: 'ProduceListing',
            entityId: 'listing-01',
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
            entityName: 'ProduceListing',
            entityId: 'listing-01',
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
            entityName: 'Order',
            entityId: 'order-01',
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
            entityName: 'Order',
            entityId: 'order-01',
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
            entityName: 'DeliveryRequest',
            entityId: 'delivery-01',
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
            entityName: 'DeliveryRequest',
            entityId: 'delivery-01',
          }),
        })
      );
    });
  });
});
