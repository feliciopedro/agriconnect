jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    produceListing: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    deliveryRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
    systemConfig: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../prisma/client';
import { SuperAdminAnalyticsService } from '../services/superadmin/analytics.service';
import { CropType, Role, ListingStatus, OrderStatus, DeliveryStatus } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SuperAdminAnalyticsService', () => {
  describe('getPlatformOverview', () => {
    it('aggregates counts and calculations correctly', async () => {
      // Mock system config
      (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue({ key: 'platform_fee_percent', value: '3.5' });

      // Mock user counts
      (prisma.user.count as jest.Mock).mockImplementation(async (args) => {
        if (!args || !args.where) return 100;
        const role = args.where.role;
        if (role === Role.FARMER) return 40;
        if (role === Role.BUYER) return 50;
        if (role === Role.TRANSPORT) return 8;
        if (role && role.in && role.in.includes(Role.ADMIN)) return 2;
        if (args.where.isVerified === true) return 90;
        if (args.where.isVerified === false) return 10;
        return 5; // new users
      });

      // Mock listing counts
      (prisma.produceListing.count as jest.Mock).mockImplementation(async (args) => {
        if (!args || !args.where) return 20;
        if (args.where.status === ListingStatus.AVAILABLE) return 15;
        if (args.where.status === ListingStatus.SOLD_OUT) return 3;
        if (args.where.status === ListingStatus.EXPIRED) return 2;
        return 20;
      });

      // Mock listings findMany
      (prisma.produceListing.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'list-01',
          cropType: CropType.TOMATO,
          quantityKg: 100,
          remainingKg: 0,
          pricePerKg: 5,
          status: ListingStatus.SOLD_OUT,
          orders: [{ quantityKg: 100 }],
        },
        {
          id: 'list-02',
          cropType: CropType.PEPPER,
          quantityKg: 50,
          remainingKg: 20,
          pricePerKg: 10,
          status: ListingStatus.EXPIRED,
          orders: [{ quantityKg: 30 }],
        },
      ]);

      // Mock order counts
      (prisma.order.count as jest.Mock).mockImplementation(async (args) => {
        if (!args || !args.where) return 10;
        if (args.where.status === OrderStatus.PENDING) return 2;
        if (args.where.status === OrderStatus.DELIVERED) return 8;
        return 0;
      });

      // Mock order findMany
      const testDate = new Date();
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        { totalPrice: 500, quantityKg: 100, createdAt: testDate },
        { totalPrice: 300, quantityKg: 30, createdAt: testDate },
      ]);

      // Mock delivery counts
      (prisma.deliveryRequest.count as jest.Mock).mockResolvedValue(2);
      (prisma.deliveryRequest.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'del-01',
          status: DeliveryStatus.DELIVERED,
          createdAt: new Date(testDate.getTime() - 3600000), // 1 hour ago
          updatedAt: testDate,
          estimatedCost: 15,
        },
      ]);

      // Mock audit logs
      (prisma.auditLog.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { targetId: 'del-01', action: 'MATCH', timestamp: new Date(testDate.getTime() - 1800000) },
        ])
        .mockResolvedValueOnce([
          { targetId: 'del-01', action: 'DELIVER', timestamp: testDate },
        ]);

      const result = await SuperAdminAnalyticsService.getPlatformOverview();

      // Check users
      expect(result.users.total).toBe(100);
      expect(result.users.farmers).toBe(40);
      expect(result.users.buyers).toBe(50);
      expect(result.users.transport).toBe(8);
      expect(result.users.admins).toBe(2);

      // Check listings
      expect(result.listings.total).toBe(20);
      expect(result.listings.available).toBe(15);
      expect(result.listings.totalKgListed).toBe(150);
      expect(result.listings.totalKgSold).toBe(130);

      // Check orders
      expect(result.orders.totalGMV).toBe(800);
      expect(result.orders.averageOrderValue).toBe(400);

      // Check deliveries
      expect(result.deliveries.averageMatchTimeMinutes).toBe(30);
      expect(result.deliveries.averageDeliveryTimeHours).toBe(0.5);

      // Check financials
      expect(result.financials.platformFeeEarned).toBe(28); // 800 * 0.035
      expect(result.financials.totalDeliveryRevenue).toBe(15);
      expect(result.financials.feesByMonth.length).toBe(6);

      // Check spoilage
      expect(result.spoilageProxy.listingsExpiredUnsold).toBe(1);
      expect(result.spoilageProxy.estimatedKgLost).toBe(20);
      expect(result.spoilageProxy.estimatedValueLost).toBe(200); // 20 * 10
    });
  });

  describe('getGrowthMetrics', () => {
    it('returns time-series stats for requested period', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(5);
      (prisma.produceListing.count as jest.Mock).mockResolvedValue(10);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        { totalPrice: 150 },
        { totalPrice: 250 },
      ]);

      const results = await SuperAdminAnalyticsService.getGrowthMetrics('daily', 3);

      expect(results.length).toBe(3);
      expect(results[0].newUsers).toBe(5);
      expect(results[1].newListings).toBe(10);
      expect(results[2].newOrders).toBe(2);
      expect(results[2].gmv).toBe(400);
    });
  });

  describe('getRegionalBreakdown', () => {
    it('groups all activity by user region', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'u1', role: Role.FARMER, region: 'Eastern' },
        { id: 'u2', role: Role.BUYER, region: 'Greater Accra' },
      ]);

      (prisma.produceListing.findMany as jest.Mock).mockResolvedValue([
        { farmer: { region: 'Eastern' } },
      ]);

      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        { totalPrice: 300, buyer: { region: 'Greater Accra' } },
      ]);

      const results = await SuperAdminAnalyticsService.getRegionalBreakdown();

      // Greater Accra should be first because of GMV = 300
      expect(results[0].region).toBe('Greater Accra');
      expect(results[0].buyerCount).toBe(1);
      expect(results[0].gmv).toBe(300);

      expect(results[1].region).toBe('Eastern');
      expect(results[1].farmerCount).toBe(1);
      expect(results[1].listingCount).toBe(1);
    });
  });

  describe('getCropPerformanceReport', () => {
    it('calculates stats for crop type mapping', async () => {
      const testDate = new Date();
      (prisma.produceListing.findMany as jest.Mock).mockResolvedValue([
        {
          cropType: CropType.TOMATO,
          quantityKg: 100,
          remainingKg: 10,
          pricePerKg: 4.5,
          status: ListingStatus.EXPIRED,
          createdAt: new Date(testDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          farmer: { id: 'f1', name: 'Farmer Joe' },
          orders: [
            { quantityKg: 90, createdAt: testDate },
          ],
        },
      ]);

      const reports = await SuperAdminAnalyticsService.getCropPerformanceReport();

      const tomatoReport = reports.find((r) => r.cropType === CropType.TOMATO)!;
      expect(tomatoReport.totalListings).toBe(1);
      expect(tomatoReport.totalKgListed).toBe(100);
      expect(tomatoReport.totalKgSold).toBe(90);
      expect(tomatoReport.spoilageRate).toBe(10); // (10 / 100) * 100
      expect(tomatoReport.avgDaysToSell).toBe(2);
      expect(tomatoReport.topFarmersByVolume[0].farmerName).toBe('Farmer Joe');
    });
  });

  describe('getTransportPerformanceReport', () => {
    it('aggregates courier deliveries', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          name: 'Speedy Couriers',
          role: Role.TRANSPORT,
          transportProfile: { vehicleType: 'Motorbike', capacityKg: 150, avgRating: 4.9 },
          deliveries: [
            {
              id: 'del-01',
              routeGroupId: 'group-1',
              createdAt: new Date(),
              updatedAt: new Date(),
              order: { quantityKg: 50 },
            },
          ],
        },
      ]);

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      const report = await SuperAdminAnalyticsService.getTransportPerformanceReport();

      expect(report.length).toBe(1);
      expect(report[0].providerName).toBe('Speedy Couriers');
      expect(report[0].totalDeliveries).toBe(1);
      expect(report[0].totalKgTransported).toBe(50);
      expect(report[0].routesGrouped).toBe(1);
    });
  });
});
