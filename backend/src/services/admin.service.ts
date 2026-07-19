import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { NotificationService } from './notification.service';
import { Role, ListingStatus, OrderStatus, TraceEventType } from '../prisma/generated-client';

export interface UserFilters {
  role?: Role;
  isVerified?: boolean;
  search?: string;
}

export class AdminService {
  /**
   * Aggregates platform statistics for dashboard consumption.
   */
  public static async getPlatformStats() {
    const nowPlus48Hours = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      userCounts,
      listingCounts,
      orderCounts,
      gmvResult,
      spoilageRisk,
      sessionsToday,
      listingsBySource,
      ordersBySource
    ] = await Promise.all([
      // User counts grouped by role
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      // Listings counts grouped by status and cropType
      prisma.produceListing.groupBy({
        by: ['status', 'cropType'],
        _count: { id: true },
      }),
      // Order counts grouped by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      // Sum of totalPrice on confirmed, in_transit, delivered orders
      prisma.order.aggregate({
        where: {
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED] },
        },
        _sum: { totalPrice: true },
      }),
      // Listings with expiry estimate < 48 hours and AVAILABLE status
      prisma.produceListing.count({
        where: {
          status: ListingStatus.AVAILABLE,
          expiryEstimate: { lt: nowPlus48Hours },
        },
      }),
      // USSD sessions today
      prisma.ussdSession.count({
        where: { startedAt: { gte: startOfDay } }
      }),
      // Listings by source
      prisma.produceListing.groupBy({
        by: ['source'],
        _count: { id: true }
      }),
      // Orders by source
      prisma.order.groupBy({
        by: ['source'],
        _count: { id: true }
      })
    ]);

    // Top 5 cropTypes by quantityKg on confirmed+ orders in the last 30 days
    const rawTopCrops: any[] = await prisma.$queryRawUnsafe(
      `SELECT l."cropType", SUM(o."quantityKg") as "totalQuantity"
       FROM "Order" o
       JOIN "ProduceListing" l ON o."listingId" = l.id
       WHERE o.status IN ('CONFIRMED', 'IN_TRANSIT', 'DELIVERED')
         AND o."createdAt" >= $1
       GROUP BY l."cropType"
       ORDER BY "totalQuantity" DESC
       LIMIT 5`,
      thirtyDaysAgo
    );

    const topCrops = rawTopCrops.map((c) => ({
      cropType: c.cropType,
      totalQuantity: parseFloat(Number(c.totalQuantity || 0).toFixed(2)),
    }));

    return {
      userCounts,
      listingCounts,
      orderCounts,
      totalGMV: gmvResult._sum.totalPrice || 0,
      topCrops,
      spoilageRisk,
      sessionsToday,
      listingsBySource,
      ordersBySource
    };
  }

  /**
   * Retrieves paginated users list incorporating profiles and name/phone search queries.
   */
  public static async getUsers(
    filters: UserFilters,
    pagination: { page?: number; limit?: number }
  ) {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.role) where.role = filters.role;
    if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          farmerProfile: true,
          buyerProfile: true,
          transportProfile: true,
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marks user account as verified and sends confirmation notification.
   */
  public static async verifyUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { isVerified: true },
      });

      await NotificationService.createNotification(
        userId,
        'ACCOUNT_VERIFIED',
        'Your account has been verified on AgriConnect',
        true,
        tx
      );

      return updatedUser;
    });

    if (user.phone) {
      try {
        const { SmsOutboundService } = require('./ussd/smsOutbound.service');
        await SmsOutboundService.sendSms(user.phone, 'account_verified', {
          name: user.name || 'User',
        });
      } catch (err) {
        console.error('Failed to send account verified SMS via SmsOutboundService:', err);
      }
    }

    return updated;
  }

  /**
   * Fetches unredacted traceability timeline (includes contact names and phones).
   * For administrator dispute resolution.
   */
  public static async getTraceForAdmin(batchCode: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { batchCode },
      include: {
        farmer: true,
        traceability: true,
        traceEvents: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!listing) {
      throw createError(`Crop batch code ${batchCode} not found`, 'BATCH_NOT_FOUND', 404);
    }

    // Find if order exists and is DELIVERED
    const deliveredOrder = await prisma.order.findFirst({
      where: {
        listingId: listing.id,
        status: OrderStatus.DELIVERED,
      },
      include: {
        buyer: {
          include: {
            buyerProfile: true,
          },
        },
      },
    });

    let deliveryInfo = undefined;
    if (deliveredOrder) {
      const deliveredEvent = listing.traceEvents.find(
        (e) => e.eventType === TraceEventType.DELIVERED
      );
      deliveryInfo = {
        deliveredAt: deliveredEvent ? deliveredEvent.timestamp : deliveredOrder.updatedAt,
        buyerType: deliveredOrder.buyer?.buyerProfile?.businessType || null,
        buyerName: deliveredOrder.buyer?.name || null,
        buyerPhone: deliveredOrder.buyer?.phone || null,
      };
    }

    return {
      batchCode: listing.batchCode,
      cropType: listing.cropType,
      qualityGrade: listing.qualityGrade,
      farmer: {
        name: listing.farmer.name,
        phone: listing.farmer.phone,
        region: listing.farmer.region,
        district: listing.farmer.district,
      },
      harvestDate: listing.harvestDate,
      plantingDate: listing.traceability?.plantingDate || null,
      inputsUsed: listing.traceability?.inputsUsed || [],
      timeline: listing.traceEvents.map((e) => ({
        eventType: e.eventType,
        timestamp: e.timestamp,
        latitude: e.latitude,
        longitude: e.longitude,
        notes: e.notes,
      })),
      ...(deliveryInfo && { deliveryInfo }),
    };
  }

  /**
   * Performs listing hard-delete moderation (cascades automatically).
   */
  public static async deleteListing(id: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    return await prisma.produceListing.delete({
      where: { id },
    });
  }
}
