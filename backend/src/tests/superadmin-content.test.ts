jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    produceListing: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    traceEvent: {
      create: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
    message: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '../prisma/client';
import { SuperAdminContentService } from '../services/superadmin/content.service';
import { Role, ListingStatus, OrderStatus, QualityGrade, PaymentStatus, TraceEventType, DeliveryStatus } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
    return cb(prisma);
  });
});

describe('SuperAdminContentService', () => {
  describe('getAllListings', () => {
    it('returns all listings with correct calculated spoilage risks and mapped parameters', async () => {
      const now = new Date();
      (prisma.produceListing.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'l1',
          cropType: 'TOMATO',
          quantityKg: 100,
          remainingKg: 90,
          pricePerKg: 4.5,
          harvestDate: now,
          expiryEstimate: new Date(now.getTime() + 12 * 60 * 60 * 1000), // 12 hours from now (critical)
          qualityGrade: QualityGrade.A,
          status: ListingStatus.AVAILABLE,
          batchCode: 'BAT-TOM-001',
          createdAt: now,
          farmer: { id: 'f1', name: 'Farmer Dan', phone: '123', region: 'Eastern' },
          orders: [{}],
        },
        {
          id: 'l2',
          cropType: 'PEPPER',
          quantityKg: 50,
          remainingKg: 50,
          pricePerKg: 8,
          harvestDate: now,
          expiryEstimate: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48 hours (high)
          qualityGrade: QualityGrade.B,
          status: ListingStatus.AVAILABLE,
          batchCode: 'BAT-PEP-001',
          createdAt: now,
          farmer: { id: 'f2', name: 'Farmer Grace', phone: '456', region: 'Greater Accra' },
          orders: [],
        },
      ]);

      const result = await SuperAdminContentService.getAllListings({}, {});

      expect(result.listings.length).toBe(2);

      const tomato = result.listings.find((l) => l.id === 'l1')!;
      expect(tomato.spoilageRisk).toBe('critical');
      expect(tomato.orderCount).toBe(1);
      expect(tomato.farmerName).toBe('Farmer Dan');

      const pepper = result.listings.find((l) => l.id === 'l2')!;
      expect(pepper.spoilageRisk).toBe('high');
      expect(pepper.orderCount).toBe(0);
    });

    it('filters listings correctly by region and spoilageRisk', async () => {
      const now = new Date();
      (prisma.produceListing.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'l1',
          cropType: 'TOMATO',
          quantityKg: 100,
          remainingKg: 90,
          pricePerKg: 4.5,
          expiryEstimate: new Date(now.getTime() + 12 * 60 * 60 * 1000), // critical
          farmer: { id: 'f1', region: 'Eastern' },
          orders: [],
        },
        {
          id: 'l2',
          cropType: 'PEPPER',
          quantityKg: 50,
          remainingKg: 50,
          pricePerKg: 8,
          expiryEstimate: new Date(now.getTime() + 100 * 60 * 60 * 1000), // low risk
          farmer: { id: 'f2', region: 'Greater Accra' },
          orders: [],
        },
      ]);

      const resRisk = await SuperAdminContentService.getAllListings({ spoilageRisk: 'critical' }, {});
      expect(resRisk.listings.length).toBe(1);
      expect(resRisk.listings[0].id).toBe('l1');

      const resRegion = await SuperAdminContentService.getAllListings({ region: 'Greater Accra' }, {});
      expect(resRegion.listings.length).toBe(1);
      expect(resRegion.listings[0].id).toBe('l2');
    });
  });

  describe('removeListing', () => {
    it('sets listing status to EXPIRED and records trace event & audit log', async () => {
      (prisma.produceListing.findUnique as jest.Mock).mockResolvedValue({
        id: 'l1',
        farmerId: 'f1',
        batchCode: 'BAT-001',
      });
      (prisma.produceListing.update as jest.Mock).mockResolvedValue({ id: 'l1', status: ListingStatus.EXPIRED });

      const result = await SuperAdminContentService.removeListing('sa-1', 'l1', 'Defective crop batch');

      expect(result.status).toBe(ListingStatus.EXPIRED);
      expect(prisma.produceListing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { status: ListingStatus.EXPIRED },
      });
      expect(prisma.traceEvent.create).toHaveBeenCalledWith({
        data: {
          listingId: 'l1',
          eventType: TraceEventType.LISTED,
          notes: 'Removed by platform admin: Defective crop batch',
        },
      });
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('overrideListingQuality', () => {
    it('updates grade and sets override source', async () => {
      (prisma.produceListing.findUnique as jest.Mock).mockResolvedValue({ id: 'l1' });
      (prisma.produceListing.update as jest.Mock).mockResolvedValue({
        id: 'l1',
        qualityGrade: QualityGrade.A,
        qualityGradeSource: 'ADMIN_OVERRIDE',
      });

      const result = await SuperAdminContentService.overrideListingQuality('sa-1', 'l1', QualityGrade.A, 'Visual inspection');

      expect(result.qualityGradeSource).toBe('ADMIN_OVERRIDE');
      expect(prisma.produceListing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { qualityGrade: QualityGrade.A, qualityGradeSource: 'ADMIN_OVERRIDE' },
      });
      expect(prisma.traceEvent.create).toHaveBeenCalled();
    });
  });

  describe('getAllOrders', () => {
    it('returns filtered and sorted orders list', async () => {
      const now = new Date();
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'o1',
          buyerId: 'b1',
          quantityKg: 200,
          totalPrice: 1000,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          createdAt: now,
          buyer: { id: 'b1', name: 'Grace', region: 'Greater Accra' },
          listing: {
            farmerId: 'f1',
            cropType: 'TOMATO',
            farmer: { id: 'f1', name: 'Farmer Dan', region: 'Eastern' },
          },
          deliveryRequest: { status: DeliveryStatus.MATCHED },
        },
      ]);

      const result = await SuperAdminContentService.getAllOrders({ minValue: 500 }, {});

      expect(result.orders.length).toBe(1);
      expect(result.orders[0].totalPrice).toBe(1000);
      expect(result.orders[0].deliveryStatus).toBe(DeliveryStatus.MATCHED);
    });
  });

  describe('cancelOrderAdmin', () => {
    it('cancels order, restores listing stock, and triggers refunds and alerts', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'o1',
        listingId: 'l1',
        quantityKg: 50,
        buyerId: 'b1',
        paymentStatus: PaymentStatus.PAID,
        listing: { farmerId: 'f1', cropType: 'TOMATO' },
      });

      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED,
      });

      const result = await SuperAdminContentService.cancelOrderAdmin('sa-1', 'o1', 'Invalid pricing');

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);

      // Verify listing remainingKg restored
      expect(prisma.produceListing.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: {
          remainingKg: { increment: 50 },
          status: ListingStatus.AVAILABLE,
        },
      });

      // Verify alerts
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });
});
