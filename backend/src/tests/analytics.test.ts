/**
 * Unit tests for the Analytics & Reporting module.
 * Covers: dashboard computations, CSV formatting, and Ghanaian tax payouts reconciliation math.
 */

// Mock Prisma client
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    order: {
      findMany: jest.fn(),
    },
    produceListing: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import prisma from '../prisma/client';
import { AnalyticsService } from '../services/analytics.service';
import { OrderStatus, ListingStatus, CropType, Role } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.order.findMany as jest.Mock).mockReset();
  (prisma.produceListing.findMany as jest.Mock).mockReset();
  (prisma.user.findUnique as jest.Mock).mockReset();
});

describe('AnalyticsService.getFarmerAnalytics', () => {
  const mockOrders = [
    // Completed last 10 days
    {
      id: 'order-01',
      buyerId: 'buyer-01',
      totalPrice: 1000,
      quantityKg: 200,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      listing: {
        id: 'listing-01',
        cropType: CropType.TOMATO,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (5 days to sell)
      },
    },
    // Completed last 60 days
    {
      id: 'order-02',
      buyerId: 'buyer-01', // Repeat buyer!
      totalPrice: 1500,
      quantityKg: 300,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      listing: {
        id: 'listing-02',
        cropType: CropType.TOMATO,
        createdAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000), // 10 days to sell
      },
    },
  ];

  const mockListings = [
    { id: 'listing-01', status: ListingStatus.SOLD_OUT },
    { id: 'listing-02', status: ListingStatus.SOLD_OUT },
    { id: 'listing-03', status: ListingStatus.EXPIRED }, // 1 expired listing
  ];

  it('aggregates revenue, repeat buyer rate, average days to sell, and spoilage rate correctly', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
    (prisma.produceListing.findMany as jest.Mock).mockResolvedValue(mockListings);

    const stats = await AnalyticsService.getFarmerAnalytics('farmer-01');

    // 1. Revenue checks
    expect(stats.revenue30Days).toBe(1000.0);
    expect(stats.revenue90Days).toBe(2500.0);

    // 2. Repeat buyer checks: 1 unique buyer (buyer-01) with 2 orders -> repeat buyer rate is 1.0 (100%)
    expect(stats.repeatBuyerRate).toBe(1.0);

    // 3. Spoilage checks: 1 expired out of 3 listings -> spoilage rate is 0.333
    expect(stats.spoilageRate).toBe(0.333);

    // 4. Days to sell: crop TOMATO (5 days + 10 days) / 2 = 7.5 days
    expect(stats.avgDaysToSell).toEqual([
      { cropType: CropType.TOMATO, avgDaysToSell: 7.5 },
    ]);
  });
});

describe('AnalyticsService.getBuyerAnalytics', () => {
  const mockOrders = [
    {
      id: 'order-01',
      buyerId: 'buyer-01',
      totalPrice: 500,
      quantityKg: 100, // 5.0 GHS/Kg
      createdAt: new Date('2026-05-15T12:00:00Z'),
      listing: {
        cropType: CropType.TOMATO,
        farmerId: 'farmer-01',
        farmer: { name: 'Farmer Kwame' },
      },
    },
  ];

  const mockGlobalListings = [
    { cropType: CropType.TOMATO, pricePerKg: 4.0 },
    { cropType: CropType.TOMATO, pricePerKg: 6.0 }, // avg global is 5.0
  ];

  it('aggregates monthly spend, favorite farmers, and calculates price compared to global average', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
    (prisma.produceListing.findMany as jest.Mock).mockResolvedValue(mockGlobalListings);

    const stats = await AnalyticsService.getBuyerAnalytics('buyer-01');

    // Monthly Spend check
    expect(stats.monthlySpend).toEqual([
      {
        month: '2026-05',
        breakdown: [{ cropType: CropType.TOMATO, totalSpend: 500.0 }],
      },
    ]);

    // Favorite Farmer checks
    expect(stats.favoriteFarmers).toEqual([
      { farmerId: 'farmer-01', farmerName: 'Farmer Kwame', completedOrdersCount: 1 },
    ]);

    // Price comparison check: buyer paid 5.0, global average is 5.0, diff should be 0.0%
    expect(stats.priceComparison).toEqual([
      {
        cropType: CropType.TOMATO,
        buyerAveragePrice: 5.0,
        platformAveragePrice: 5.0,
        differencePct: 0.0,
      },
    ]);
  });
});

describe('Admin CSV Reports', () => {
  it('generates a CSV containing orders rows in date range', async () => {
    const mockDateRangeOrders = [
      {
        id: 'order-c-01',
        buyerId: 'buyer-01',
        totalPrice: 1000.0,
        quantityKg: 200,
        depositCredit: 0,
        status: OrderStatus.DELIVERED,
        paymentStatus: 'PAID',
        createdAt: new Date('2026-06-25T10:00:00Z'),
        buyer: { name: 'Buyer Yaw', phone: '+233240000001' },
        listing: { cropType: CropType.TOMATO, pricePerKg: 5.0, batchCode: 'BAT-TOM-01' },
        deliveryRequest: { estimatedCost: 100.0 },
      },
    ];

    (prisma.order.findMany as jest.Mock).mockResolvedValue(mockDateRangeOrders);

    const csv = await AnalyticsService.exportOrdersReportCsv('2026-06-01T00:00:00Z', '2026-06-30T23:59:59Z');

    expect(csv).toContain('OrderID,BuyerName,BuyerPhone');
    expect(csv).toContain('order-c-01,"Buyer Yaw",+233240000001,TOMATO,BAT-TOM-01,200.0,5.00,1000.00,100.00,0.00,1000.00,DELIVERED,PAID');
  });

  it('calculates gross revenue, 5% commission, and net payout in reconciliation report', async () => {
    const mockPayoutOrders = [
      {
        id: 'order-p-01',
        totalPrice: 100.0,
        listing: {
          farmerId: 'farmer-kwame',
          farmer: { name: 'Kwame Agro', phone: '+233240000002' },
        },
      },
    ];

    (prisma.order.findMany as jest.Mock).mockResolvedValue(mockPayoutOrders);

    const csv = await AnalyticsService.exportFarmerPayoutsCsv();

    expect(csv).toContain('FarmerID,FarmerName,FarmerPhone,TotalOrdersCount,GrossRevenue,PlatformCommission5Pct,NetPayoutAmount');
    expect(csv).toContain('farmer-kwame,"Kwame Agro",+233240000002,1,100.00,5.00,95.00'); // Gross: 100, Comm: 5, Net: 95
  });

  it('aggregates expired produce loss calculations in spoilage report grouped by region and crop', async () => {
    const mockExpiredListings = [
      {
        id: 'list-e-01',
        cropType: CropType.TOMATO,
        remainingKg: 100,
        pricePerKg: 5.0,
        farmer: { region: 'Eastern' },
      },
    ];

    (prisma.produceListing.findMany as jest.Mock).mockResolvedValue(mockExpiredListings);

    const csv = await AnalyticsService.exportSpoilageCsv();

    expect(csv).toContain('Region,CropType,ExpiredListingsCount,TotalWastedQuantityKg,EstimatedLossValueGHS');
    expect(csv).toContain('"Eastern",TOMATO,1,100.0,500.00');
  });
});
