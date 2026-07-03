import prisma from '../../prisma/client';
import { CropType, Role, ListingStatus, OrderStatus, DeliveryStatus } from '../../prisma/generated-client';
import { RuntimeConfig } from '../../config/runtimeConfig';

export class SuperAdminAnalyticsService {
  /**
   * Returns a comprehensive platform overview.
   */
  public static async getPlatformOverview() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. User metrics
    const [
      totalUsers,
      farmers,
      buyers,
      transport,
      admins,
      verifiedCount,
      unverifiedCount,
      newThisWeek,
      newThisMonth,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.FARMER } }),
      prisma.user.count({ where: { role: Role.BUYER } }),
      prisma.user.count({ where: { role: Role.TRANSPORT } }),
      prisma.user.count({ where: { role: { in: [Role.ADMIN, Role.SUPERADMIN] } } }),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.user.count({ where: { isVerified: false } }),
      prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: oneMonthAgo } } }),
    ]);

    // 2. Listing metrics
    const [
      totalListings,
      availableListings,
      soldOutListings,
      expiredListings,
    ] = await Promise.all([
      prisma.produceListing.count(),
      prisma.produceListing.count({ where: { status: ListingStatus.AVAILABLE } }),
      prisma.produceListing.count({ where: { status: ListingStatus.SOLD_OUT } }),
      prisma.produceListing.count({ where: { status: ListingStatus.EXPIRED } }),
    ]);

    const listings = await prisma.produceListing.findMany({
      include: {
        orders: {
          where: { status: { not: OrderStatus.CANCELLED } },
          select: { quantityKg: true },
        },
      },
    });

    const totalKgListed = listings.reduce((sum, l) => sum + l.quantityKg, 0);
    const totalKgSold = listings.reduce(
      (sum, l) => sum + l.orders.reduce((orderSum, o) => orderSum + o.quantityKg, 0),
      0
    );

    // Group listings by crop type in memory
    const cropGroupMap = new Map<string, { cropType: string; count: number; totalKgListed: number; totalKgSold: number }>();
    for (const crop of Object.values(CropType)) {
      cropGroupMap.set(crop, {
        cropType: crop,
        count: 0,
        totalKgListed: 0,
        totalKgSold: 0,
      });
    }

    for (const l of listings) {
      const stats = cropGroupMap.get(l.cropType) || {
        cropType: l.cropType,
        count: 0,
        totalKgListed: 0,
        totalKgSold: 0,
      };
      stats.count++;
      stats.totalKgListed += l.quantityKg;
      stats.totalKgSold += l.orders.reduce((orderSum, o) => orderSum + o.quantityKg, 0);
      cropGroupMap.set(l.cropType, stats);
    }

    const byCrop = Array.from(cropGroupMap.values()).map((c) => ({
      cropType: c.cropType,
      count: c.count,
      totalKgListed: parseFloat(c.totalKgListed.toFixed(2)),
      totalKgSold: parseFloat(c.totalKgSold.toFixed(2)),
    }));

    // 3. Order metrics
    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      inTransitOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
      prisma.order.count({ where: { status: OrderStatus.IN_TRANSIT } }),
      prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
      prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    ]);

    const activeOrders = await prisma.order.findMany({
      where: { status: { not: OrderStatus.CANCELLED } },
      select: { totalPrice: true, quantityKg: true, createdAt: true },
    });

    const totalGMV = activeOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const gmvThisMonth = activeOrders
      .filter((o) => o.createdAt >= oneMonthAgo)
      .reduce((sum, o) => sum + o.totalPrice, 0);
    const gmvThisWeek = activeOrders
      .filter((o) => o.createdAt >= oneWeekAgo)
      .reduce((sum, o) => sum + o.totalPrice, 0);

    const totalActiveOrders = activeOrders.length;
    const averageOrderValue = totalActiveOrders > 0 ? parseFloat((totalGMV / totalActiveOrders).toFixed(2)) : 0;
    const averageOrderKg = totalActiveOrders > 0 ? parseFloat((totalKgSold / totalActiveOrders).toFixed(2)) : 0;

    // 4. Delivery metrics
    const [
      totalDeliveries,
      requestedDeliveries,
      matchedDeliveries,
      pickedUpDeliveries,
      deliveredDeliveries,
    ] = await Promise.all([
      prisma.deliveryRequest.count(),
      prisma.deliveryRequest.count({ where: { status: DeliveryStatus.REQUESTED } }),
      prisma.deliveryRequest.count({ where: { status: DeliveryStatus.MATCHED } }),
      prisma.deliveryRequest.count({ where: { status: DeliveryStatus.PICKED_UP } }),
      prisma.deliveryRequest.count({ where: { status: DeliveryStatus.DELIVERED } }),
    ]);

    const allDeliveries = await prisma.deliveryRequest.findMany({
      select: { id: true, status: true, createdAt: true, updatedAt: true },
    });

    const matchLogs = await prisma.auditLog.findMany({
      where: { action: 'MATCH', targetType: 'DeliveryRequest' },
      select: { targetId: true, timestamp: true },
    });
    const deliverLogs = await prisma.auditLog.findMany({
      where: { action: 'DELIVER', targetType: 'DeliveryRequest' },
      select: { targetId: true, timestamp: true },
    });

    const matchLogMap = new Map(matchLogs.map((l) => [l.targetId, l.timestamp]));
    const deliverLogMap = new Map(deliverLogs.map((l) => [l.targetId, l.timestamp]));

    let totalMatchTimeMs = 0;
    let matchCount = 0;
    let totalDeliveryTimeMs = 0;
    let deliveryCount = 0;

    for (const del of allDeliveries) {
      if (del.status !== DeliveryStatus.REQUESTED) {
        const matchTime = matchLogMap.get(del.id);
        if (matchTime) {
          totalMatchTimeMs += matchTime.getTime() - del.createdAt.getTime();
          matchCount++;
        } else {
          totalMatchTimeMs += Math.max(0, del.updatedAt.getTime() - del.createdAt.getTime());
          matchCount++;
        }
      }

      if (del.status === DeliveryStatus.DELIVERED) {
        const matchTime = matchLogMap.get(del.id);
        const deliverTime = deliverLogMap.get(del.id);
        if (matchTime && deliverTime) {
          totalDeliveryTimeMs += deliverTime.getTime() - matchTime.getTime();
          deliveryCount++;
        } else {
          const durationMs = del.updatedAt.getTime() - del.createdAt.getTime();
          totalDeliveryTimeMs += Math.max(7200000, durationMs * 0.8); // fallback: 80% of total duration or 2 hours minimum
          deliveryCount++;
        }
      }
    }

    const averageMatchTimeMinutes = matchCount > 0 ? parseFloat((totalMatchTimeMs / (1000 * 60) / matchCount).toFixed(2)) : 0;
    const averageDeliveryTimeHours = deliveryCount > 0 ? parseFloat((totalDeliveryTimeMs / (1000 * 60 * 60) / deliveryCount).toFixed(2)) : 0;

    // 5. Financials
    const feePercent = RuntimeConfig.getNumber('platform_fee_percent', 3.5);
    const platformFeeEarned = parseFloat((totalGMV * feePercent / 100).toFixed(2));

    const completedDeliveries = await prisma.deliveryRequest.findMany({
      where: { status: DeliveryStatus.DELIVERED },
      select: { estimatedCost: true },
    });
    const totalDeliveryRevenue = completedDeliveries.reduce((sum, d) => sum + (d.estimatedCost || 0), 0);

    const feesByMonth: { month: string; fee: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const startOfMonth = new Date(year, monthIndex, 1);
      const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const monthOrders = activeOrders.filter((o) => o.createdAt >= startOfMonth && o.createdAt <= endOfMonth);
      const monthGmv = monthOrders.reduce((sum, o) => sum + o.totalPrice, 0);
      const fee = parseFloat((monthGmv * feePercent / 100).toFixed(2));

      feesByMonth.push({
        month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        fee,
      });
    }

    // 6. Spoilage Proxy metrics
    const expiredUnsoldListings = listings.filter(
      (l) => l.status === ListingStatus.EXPIRED && l.remainingKg > 0
    );
    const listingsExpiredUnsold = expiredUnsoldListings.length;
    const estimatedKgLost = expiredUnsoldListings.reduce((sum, l) => sum + l.remainingKg, 0);
    const estimatedValueLost = expiredUnsoldListings.reduce((sum, l) => sum + l.remainingKg * l.pricePerKg, 0);

    return {
      users: {
        total: totalUsers,
        farmers,
        buyers,
        transport,
        admins,
        verifiedCount,
        unverifiedCount,
        newThisWeek,
        newThisMonth,
      },
      listings: {
        total: totalListings,
        available: availableListings,
        soldOut: soldOutListings,
        expired: expiredListings,
        totalKgListed: parseFloat(totalKgListed.toFixed(2)),
        totalKgSold: parseFloat(totalKgSold.toFixed(2)),
        byCrop,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        confirmed: confirmedOrders,
        inTransit: inTransitOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        totalGMV: parseFloat(totalGMV.toFixed(2)),
        gmvThisMonth: parseFloat(gmvThisMonth.toFixed(2)),
        gmvThisWeek: parseFloat(gmvThisWeek.toFixed(2)),
        averageOrderValue,
        averageOrderKg,
      },
      deliveries: {
        total: totalDeliveries,
        requested: requestedDeliveries,
        matched: matchedDeliveries,
        pickedUp: pickedUpDeliveries,
        delivered: deliveredDeliveries,
        averageMatchTimeMinutes,
        averageDeliveryTimeHours,
      },
      financials: {
        totalGMV: parseFloat(totalGMV.toFixed(2)),
        platformFeeEarned,
        totalDeliveryRevenue: parseFloat(totalDeliveryRevenue.toFixed(2)),
        feesByMonth,
      },
      spoilageProxy: {
        listingsExpiredUnsold,
        estimatedKgLost: parseFloat(estimatedKgLost.toFixed(2)),
        estimatedValueLost: parseFloat(estimatedValueLost.toFixed(2)),
      },
    };
  }

  /**
   * Returns growth time-series data for dashboard visualization.
   */
  public static async getGrowthMetrics(period: 'daily' | 'weekly' | 'monthly', lookback: number) {
    const results = [];
    const now = new Date();

    for (let i = lookback - 1; i >= 0; i--) {
      let start: Date;
      let end: Date;
      let label: string;

      if (period === 'daily') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);
        label = start.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const dayOffset = now.getDay() === 0 ? 6 : now.getDay() - 1; // get start of current week (Monday)
        const baseMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
        start = new Date(baseMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
        label = `Week of ${start.toISOString().split('T')[0]}`;
      } else {
        start = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      }

      const [newUsers, newListings, activeOrders] = await Promise.all([
        prisma.user.count({
          where: { createdAt: { gte: start, lte: end } },
        }),
        prisma.produceListing.count({
          where: { createdAt: { gte: start, lte: end } },
        }),
        prisma.order.findMany({
          where: {
            createdAt: { gte: start, lte: end },
            status: { not: OrderStatus.CANCELLED },
          },
          select: { totalPrice: true },
        }),
      ]);

      const newOrders = activeOrders.length;
      const gmv = activeOrders.reduce((sum, o) => sum + o.totalPrice, 0);

      results.push({
        date: label,
        newUsers,
        newListings,
        newOrders,
        gmv: parseFloat(gmv.toFixed(2)),
      });
    }

    return results;
  }

  /**
   * Returns a breakdown of activities grouped by user region.
   */
  public static async getRegionalBreakdown() {
    const [users, listings, orders] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, role: true, region: true },
      }),
      prisma.produceListing.findMany({
        select: { farmer: { select: { region: true } } },
      }),
      prisma.order.findMany({
        where: { status: { not: OrderStatus.CANCELLED } },
        select: {
          totalPrice: true,
          buyer: { select: { region: true } },
        },
      }),
    ]);

    const regionsMap = new Map<string, { region: string; farmerCount: number; buyerCount: number; listingCount: number; orderCount: number; gmv: number }>();

    const getOrCreateRegion = (regionName: string | null) => {
      const key = regionName || 'Unknown';
      if (!regionsMap.has(key)) {
        regionsMap.set(key, {
          region: key,
          farmerCount: 0,
          buyerCount: 0,
          listingCount: 0,
          orderCount: 0,
          gmv: 0,
        });
      }
      return regionsMap.get(key)!;
    };

    for (const u of users) {
      const reg = getOrCreateRegion(u.region);
      if (u.role === Role.FARMER) reg.farmerCount++;
      else if (u.role === Role.BUYER) reg.buyerCount++;
    }

    for (const l of listings) {
      const reg = getOrCreateRegion(l.farmer?.region);
      reg.listingCount++;
    }

    for (const o of orders) {
      const reg = getOrCreateRegion(o.buyer?.region);
      reg.orderCount++;
      reg.gmv += o.totalPrice;
    }

    const results = Array.from(regionsMap.values());
    for (const r of results) {
      r.gmv = parseFloat(r.gmv.toFixed(2));
    }

    // Order by GMV descending
    return results.sort((a, b) => b.gmv - a.gmv);
  }

  /**
   * Measures performance and spoilage rates for each CropType.
   */
  public static async getCropPerformanceReport() {
    const listings = await prisma.produceListing.findMany({
      include: {
        farmer: { select: { id: true, name: true } },
        orders: {
          where: { status: { not: OrderStatus.CANCELLED } },
          select: { quantityKg: true, createdAt: true },
        },
      },
    });

    const cropTypes = Object.values(CropType);
    const reports = [];

    for (const crop of cropTypes) {
      const cropListings = listings.filter((l) => l.cropType === crop);
      const totalListings = cropListings.length;
      const totalKgListed = cropListings.reduce((sum, l) => sum + l.quantityKg, 0);

      // Expired listings sum
      const expiredListings = cropListings.filter((l) => l.status === ListingStatus.EXPIRED);
      const expiredKg = expiredListings.reduce((sum, l) => sum + l.remainingKg, 0);
      const spoilageRate = totalKgListed > 0 ? parseFloat(((expiredKg / totalKgListed) * 100).toFixed(2)) : 0;

      // Price sum
      const totalPriceSum = cropListings.reduce((sum, l) => sum + l.pricePerKg, 0);
      const avgPricePerKg = totalListings > 0 ? parseFloat((totalPriceSum / totalListings).toFixed(2)) : 0;

      let totalKgSold = 0;
      let totalDaysToSell = 0;
      let sellCount = 0;
      const farmerVolumeMap = new Map<string, { name: string; volume: number }>();

      for (const l of cropListings) {
        const orderSum = l.orders.reduce((sum, o) => sum + o.quantityKg, 0);
        totalKgSold += orderSum;

        if (l.farmer) {
          const fid = l.farmer.id;
          const current = farmerVolumeMap.get(fid) || { name: l.farmer.name, volume: 0 };
          current.volume += orderSum;
          farmerVolumeMap.set(fid, current);
        }

        if (l.orders.length > 0) {
          const earliestOrderTime = Math.min(...l.orders.map((o) => o.createdAt.getTime()));
          const diffTime = earliestOrderTime - l.createdAt.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          totalDaysToSell += Math.max(0, diffDays);
          sellCount++;
        }
      }

      const avgDaysToSell = sellCount > 0 ? parseFloat((totalDaysToSell / sellCount).toFixed(2)) : 0;

      const topFarmersByVolume = Array.from(farmerVolumeMap.entries())
        .map(([farmerId, data]) => ({
          farmerId,
          farmerName: data.name,
          totalKgSold: parseFloat(data.volume.toFixed(2)),
        }))
        .filter((f) => f.totalKgSold > 0)
        .sort((a, b) => b.totalKgSold - a.totalKgSold)
        .slice(0, 3); // top 3 farmers

      reports.push({
        cropType: crop,
        totalListings,
        totalKgListed: parseFloat(totalKgListed.toFixed(2)),
        totalKgSold: parseFloat(totalKgSold.toFixed(2)),
        avgPricePerKg,
        spoilageRate,
        avgDaysToSell,
        topFarmersByVolume,
      });
    }

    return reports;
  }

  /**
   * Aggregates transporter ratings, speeds, delivery volumes, and batching logs.
   */
  public static async getTransportPerformanceReport() {
    const transporters = await prisma.user.findMany({
      where: { role: Role.TRANSPORT },
      include: {
        transportProfile: true,
        deliveries: {
          where: { status: DeliveryStatus.DELIVERED },
          include: { order: true },
        },
      },
    });

    const deliveryIds = transporters.flatMap((t) => t.deliveries.map((d) => d.id));

    const [matchLogs, deliverLogs] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: 'MATCH',
          targetType: 'DeliveryRequest',
          targetId: { in: deliveryIds },
        },
        select: { targetId: true, timestamp: true },
      }),
      prisma.auditLog.findMany({
        where: {
          action: 'DELIVER',
          targetType: 'DeliveryRequest',
          targetId: { in: deliveryIds },
        },
        select: { targetId: true, timestamp: true },
      }),
    ]);

    const matchLogMap = new Map(matchLogs.map((l) => [l.targetId, l.timestamp]));
    const deliverLogMap = new Map(deliverLogs.map((l) => [l.targetId, l.timestamp]));

    const reports = [];

    for (const t of transporters) {
      const profile = t.transportProfile;
      const completedDeliveries = t.deliveries;
      const totalDeliveries = completedDeliveries.length;
      const totalKgTransported = completedDeliveries.reduce((sum, d) => sum + (d.order?.quantityKg || 0), 0);

      let totalDurationMs = 0;
      let countWithDuration = 0;
      let routesGrouped = 0;

      for (const del of completedDeliveries) {
        if (del.routeGroupId) {
          routesGrouped++;
        }

        const matchTime = matchLogMap.get(del.id);
        const deliverTime = deliverLogMap.get(del.id);

        if (matchTime && deliverTime) {
          totalDurationMs += deliverTime.getTime() - matchTime.getTime();
          countWithDuration++;
        } else {
          const durationMs = del.updatedAt.getTime() - del.createdAt.getTime();
          totalDurationMs += Math.max(7200000, durationMs * 0.8);
          countWithDuration++;
        }
      }

      const avgDeliveryTimeHours = countWithDuration > 0
        ? parseFloat((totalDurationMs / (1000 * 60 * 60) / countWithDuration).toFixed(2))
        : 0;

      reports.push({
        providerId: t.id,
        providerName: t.name,
        vehicleType: profile?.vehicleType || 'Unknown',
        capacityKg: profile?.capacityKg || 0,
        totalDeliveries,
        totalKgTransported: parseFloat(totalKgTransported.toFixed(2)),
        avgRating: profile?.avgRating || 0,
        avgDeliveryTimeHours,
        routesGrouped,
      });
    }

    // Sort by totalDeliveries descending
    return reports.sort((a, b) => b.totalDeliveries - a.totalDeliveries);
  }
}
