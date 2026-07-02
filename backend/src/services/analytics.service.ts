import prisma from '../prisma/client';
import { OrderStatus, ListingStatus, CropType } from '../prisma/generated-client';

export class AnalyticsService {
  /**
   * Aggregates analytics dashboard metrics for a farmer.
   */
  public static async getFarmerAnalytics(farmerId: string) {
    const now = new Date();
    const date30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const date90DaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Fetch all completed orders for this farmer
    const completedOrders = await prisma.order.findMany({
      where: {
        listing: { farmerId },
        status: OrderStatus.DELIVERED,
      },
      include: { listing: true },
    });

    // 1. Revenue last 30 & 90 days
    let revenue30Days = 0;
    let revenue90Days = 0;

    for (const order of completedOrders) {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= date30DaysAgo) {
        revenue30Days += order.totalPrice;
      }
      if (orderDate >= date90DaysAgo) {
        revenue90Days += order.totalPrice;
      }
    }

    // 2. Top-selling crops
    const cropSalesMap = new Map<CropType, { quantity: number; revenue: number }>();
    for (const order of completedOrders) {
      const crop = order.listing.cropType;
      const current = cropSalesMap.get(crop) || { quantity: 0, revenue: 0 };
      cropSalesMap.set(crop, {
        quantity: current.quantity + order.quantityKg,
        revenue: current.revenue + order.totalPrice,
      });
    }

    const topSellingCrops = Array.from(cropSalesMap.entries())
      .map(([cropType, sales]) => ({
        cropType,
        totalQuantityKg: sales.quantity,
        totalRevenue: parseFloat(sales.revenue.toFixed(2)),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    // 3. Average days to sell per crop type
    const cropDaysToSellMap = new Map<CropType, { totalDays: number; count: number }>();
    for (const order of completedOrders) {
      const crop = order.listing.cropType;
      const durationMs = new Date(order.createdAt).getTime() - new Date(order.listing.createdAt).getTime();
      const durationDays = durationMs / (24 * 60 * 60 * 1000);

      const current = cropDaysToSellMap.get(crop) || { totalDays: 0, count: 0 };
      cropDaysToSellMap.set(crop, {
        totalDays: current.totalDays + Math.max(0, durationDays),
        count: current.count + 1,
      });
    }

    const avgDaysToSell = Array.from(cropDaysToSellMap.entries()).map(([cropType, data]) => ({
      cropType,
      avgDaysToSell: parseFloat((data.totalDays / data.count).toFixed(1)),
    }));

    // 4. Repeat buyer rate
    const buyerOrderCounts = new Map<string, number>();
    for (const order of completedOrders) {
      const count = buyerOrderCounts.get(order.buyerId) || 0;
      buyerOrderCounts.set(order.buyerId, count + 1);
    }

    const uniqueBuyersCount = buyerOrderCounts.size;
    const repeatBuyersCount = Array.from(buyerOrderCounts.values()).filter((cnt) => cnt >= 2).length;
    const repeatBuyerRate = uniqueBuyersCount > 0
      ? parseFloat((repeatBuyersCount / uniqueBuyersCount).toFixed(3))
      : 0.0;

    // 5. Spoilage rate (listings expired unsold)
    const farmerListings = await prisma.produceListing.findMany({
      where: { farmerId },
      select: { status: true },
    });

    const totalListings = farmerListings.length;
    const expiredListings = farmerListings.filter((l) => l.status === ListingStatus.EXPIRED).length;
    const spoilageRate = totalListings > 0
      ? parseFloat((expiredListings / totalListings).toFixed(3))
      : 0.0;

    return {
      revenue30Days: parseFloat(revenue30Days.toFixed(2)),
      revenue90Days: parseFloat(revenue90Days.toFixed(2)),
      topSellingCrops,
      avgDaysToSell,
      repeatBuyerRate,
      spoilageRate,
    };
  }

  /**
   * Aggregates spending analytics metrics for a buyer.
   */
  public static async getBuyerAnalytics(buyerId: string) {
    const completedOrders = await prisma.order.findMany({
      where: {
        buyerId,
        status: OrderStatus.DELIVERED,
      },
      include: {
        listing: {
          include: {
            farmer: { select: { name: true } },
          },
        },
      },
    });

    // 1. Monthly spend by crop category
    const monthlySpendMap = new Map<string, Map<CropType, number>>();
    for (const order of completedOrders) {
      const date = new Date(order.createdAt);
      // Format key: YYYY-MM
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const crop = order.listing.cropType;

      if (!monthlySpendMap.has(monthKey)) {
        monthlySpendMap.set(monthKey, new Map<CropType, number>());
      }
      const cropMap = monthlySpendMap.get(monthKey)!;
      const currentSpend = cropMap.get(crop) || 0;
      cropMap.set(crop, currentSpend + order.totalPrice);
    }

    const monthlySpend = Array.from(monthlySpendMap.entries()).map(([month, cropMap]) => ({
      month,
      breakdown: Array.from(cropMap.entries()).map(([cropType, spend]) => ({
        cropType,
        totalSpend: parseFloat(spend.toFixed(2)),
      })),
    }));

    // 2. Favorite farmers (repeat orders count)
    const farmerOrderCounts = new Map<string, { name: string; count: number }>();
    for (const order of completedOrders) {
      const farmerId = order.listing.farmerId;
      const current = farmerOrderCounts.get(farmerId) || { name: order.listing.farmer.name, count: 0 };
      farmerOrderCounts.set(farmerId, {
        name: current.name,
        count: current.count + 1,
      });
    }

    const favoriteFarmers = Array.from(farmerOrderCounts.entries())
      .map(([farmerId, data]) => ({
        farmerId,
        farmerName: data.name,
        completedOrdersCount: data.count,
      }))
      .sort((a, b) => b.completedOrdersCount - a.completedOrdersCount)
      .slice(0, 5);

    // 3. Price paid vs market average
    const buyerCropPricesMap = new Map<CropType, { totalPrice: number; totalQty: number }>();
    for (const order of completedOrders) {
      const crop = order.listing.cropType;
      const current = buyerCropPricesMap.get(crop) || { totalPrice: 0, totalQty: 0 };
      buyerCropPricesMap.set(crop, {
        totalPrice: current.totalPrice + order.totalPrice,
        totalQty: current.totalQty + order.quantityKg,
      });
    }

    // Query global averages per crop type
    const globalListings = await prisma.produceListing.findMany({
      select: { cropType: true, pricePerKg: true },
    });

    const globalCropPricesMap = new Map<CropType, { sumPrice: number; count: number }>();
    for (const listing of globalListings) {
      const crop = listing.cropType;
      const current = globalCropPricesMap.get(crop) || { sumPrice: 0, count: 0 };
      globalCropPricesMap.set(crop, {
        sumPrice: current.sumPrice + listing.pricePerKg,
        count: current.count + 1,
      });
    }

    const priceComparison = Array.from(buyerCropPricesMap.entries()).map(([cropType, buyerData]) => {
      const buyerAvg = buyerData.totalPrice / buyerData.totalQty;
      const globalData = globalCropPricesMap.get(cropType);
      const globalAvg = globalData ? globalData.sumPrice / globalData.count : buyerAvg;
      const differencePct = globalAvg > 0 ? parseFloat((((buyerAvg - globalAvg) / globalAvg) * 100).toFixed(1)) : 0.0;

      return {
        cropType,
        buyerAveragePrice: parseFloat(buyerAvg.toFixed(2)),
        platformAveragePrice: parseFloat(globalAvg.toFixed(2)),
        differencePct,
      };
    });

    return {
      monthlySpend,
      favoriteFarmers,
      priceComparison,
    };
  }

  /**
   * Compiles all orders in a date range into a CSV string.
   */
  public static async exportOrdersReportCsv(startDate?: string, endDate?: string): Promise<string> {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        buyer: { select: { name: true, phone: true } },
        listing: { select: { cropType: true, pricePerKg: true, batchCode: true } },
        deliveryRequest: { select: { estimatedCost: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'OrderID',
      'BuyerName',
      'BuyerPhone',
      'CropType',
      'BatchCode',
      'QuantityKg',
      'UnitPrice',
      'Subtotal',
      'DeliveryFee',
      'DepositOffset',
      'TotalPrice',
      'Status',
      'PaymentStatus',
      'CreatedAt',
    ];

    const rows = orders.map((o) => {
      const subtotal = o.quantityKg * o.listing.pricePerKg;
      return [
        o.id,
        `"${o.buyer.name.replace(/"/g, '""')}"`,
        o.buyer.phone,
        o.listing.cropType,
        o.listing.batchCode,
        o.quantityKg.toFixed(1),
        o.listing.pricePerKg.toFixed(2),
        subtotal.toFixed(2),
        (o.deliveryRequest?.estimatedCost || 0.0).toFixed(2),
        o.depositCredit.toFixed(2),
        o.totalPrice.toFixed(2),
        o.status,
        o.paymentStatus,
        o.createdAt.toISOString(),
      ];
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Compiles farmer payout reconciliation statistics into a CSV string.
   * Commission rate: 5% of gross revenue is retained by the platform.
   */
  public static async exportFarmerPayoutsCsv(): Promise<string> {
    const completedOrders = await prisma.order.findMany({
      where: { status: OrderStatus.DELIVERED },
      include: {
        listing: {
          include: {
            farmer: { select: { name: true, phone: true } },
          },
        },
      },
    });

    const farmerSummary = new Map<
      string,
      { name: string; phone: string; ordersCount: number; grossRevenue: number }
    >();

    for (const order of completedOrders) {
      const farmerId = order.listing.farmerId;
      const farmer = order.listing.farmer;
      const current = farmerSummary.get(farmerId) || {
        name: farmer.name,
        phone: farmer.phone,
        ordersCount: 0,
        grossRevenue: 0,
      };

      farmerSummary.set(farmerId, {
        name: current.name,
        phone: current.phone,
        ordersCount: current.ordersCount + 1,
        grossRevenue: current.grossRevenue + order.totalPrice,
      });
    }

    const headers = [
      'FarmerID',
      'FarmerName',
      'FarmerPhone',
      'TotalOrdersCount',
      'GrossRevenue',
      'PlatformCommission5Pct',
      'NetPayoutAmount',
    ];

    const rows = Array.from(farmerSummary.entries()).map(([farmerId, summary]) => {
      const commission = summary.grossRevenue * 0.05;
      const netPayout = summary.grossRevenue - commission;

      return [
        farmerId,
        `"${summary.name.replace(/"/g, '""')}"`,
        summary.phone,
        summary.ordersCount,
        summary.grossRevenue.toFixed(2),
        commission.toFixed(2),
        netPayout.toFixed(2),
      ];
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Compiles regional produce spoilage statistics into a CSV string.
   */
  public static async exportSpoilageCsv(): Promise<string> {
    const expiredListings = await prisma.produceListing.findMany({
      where: { status: ListingStatus.EXPIRED },
      include: {
        farmer: { select: { region: true } },
      },
    });

    // Grouping by Region -> CropType
    const grouping = new Map<string, Map<CropType, { count: number; weight: number; value: number }>>();

    for (const l of expiredListings) {
      const region = l.farmer.region || 'Unknown Region';
      const crop = l.cropType;
      const value = l.remainingKg * l.pricePerKg;

      if (!grouping.has(region)) {
        grouping.set(region, new Map<CropType, { count: number; weight: number; value: number }>());
      }
      const cropMap = grouping.get(region)!;
      const current = cropMap.get(crop) || { count: 0, weight: 0, value: 0 };
      
      cropMap.set(crop, {
        count: current.count + 1,
        weight: current.weight + l.remainingKg,
        value: current.value + value,
      });
    }

    const headers = [
      'Region',
      'CropType',
      'ExpiredListingsCount',
      'TotalWastedQuantityKg',
      'EstimatedLossValueGHS',
    ];

    const rows: string[][] = [];

    for (const [region, cropMap] of grouping.entries()) {
      for (const [cropType, data] of cropMap.entries()) {
        rows.push([
          `"${region.replace(/"/g, '""')}"`,
          cropType,
          data.count.toString(),
          data.weight.toFixed(1),
          data.value.toFixed(2),
        ]);
      }
    }

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
