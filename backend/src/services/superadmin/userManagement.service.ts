import prisma from '../../prisma/client';
import { Role, OrderStatus, DeliveryStatus, ListingStatus } from '../../prisma/generated-client';
import { createError } from '../../utils/errors';
import { AuditLogService } from '../audit.service';
import { NotificationService } from '../notification.service';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

export class SuperAdminUserManagementService {
  /**
   * Retrieves all users with filtering, sorting, and pagination.
   */
  public static async getAllUsers(
    filters: {
      role?: string;
      isVerified?: boolean;
      isBanned?: boolean;
      region?: string;
      search?: string;
      createdAfter?: string;
      createdBefore?: string;
    },
    pagination: {
      limit?: number;
      page?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const users = await prisma.user.findMany({
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transportProfile: true,
        ban: true,
        listings: {
          include: {
            orders: {
              where: { status: { not: OrderStatus.CANCELLED } },
              select: { quantityKg: true },
            },
          },
        },
        orders: {
          where: { status: { not: OrderStatus.CANCELLED } },
          select: { totalPrice: true },
        },
        deliveries: {
          where: { status: DeliveryStatus.DELIVERED },
        },
      },
    });

    let mapped = users.map((u) => {
      let listingCount = 0;
      let totalKgSold = 0;
      let orderCount = 0;
      let totalSpend = 0;
      let deliveryCount = 0;
      let avgRating = 0;

      if (u.role === Role.FARMER) {
        listingCount = u.listings.length;
        totalKgSold = u.listings.reduce((sum, l) => sum + l.orders.reduce((os, o) => os + o.quantityKg, 0), 0);
        avgRating = u.farmerProfile?.avgRating || 0;
      } else if (u.role === Role.BUYER) {
        orderCount = u.orders.length;
        totalSpend = u.orders.reduce((sum, o) => sum + o.totalPrice, 0);
        avgRating = u.buyerProfile?.avgRating || 0;
      } else if (u.role === Role.TRANSPORT) {
        deliveryCount = u.deliveries.length;
        avgRating = u.transportProfile?.avgRating || 0;
      }

      const isBanned = !!(u.ban && u.ban.isActive);

      return {
        id: u.id,
        phone: u.phone,
        name: u.name,
        role: u.role,
        isVerified: u.isVerified,
        createdAt: u.createdAt,
        region: u.region,
        district: u.district,
        isBanned,
        banReason: u.ban?.isActive ? u.ban.reason : null,
        banExpiresAt: u.ban?.isActive ? u.ban.expiresAt : null,
        farmerProfile: u.farmerProfile,
        buyerProfile: u.buyerProfile,
        transportProfile: u.transportProfile,
        stats: {
          listingCount,
          totalKgSold: parseFloat(totalKgSold.toFixed(2)),
          orderCount,
          totalSpend: parseFloat(totalSpend.toFixed(2)),
          deliveryCount,
          avgRating,
        },
      };
    });

    // Apply filters
    if (filters.role) {
      mapped = mapped.filter((u) => u.role === filters.role);
    }
    if (filters.isVerified !== undefined) {
      mapped = mapped.filter((u) => u.isVerified === filters.isVerified);
    }
    if (filters.isBanned !== undefined) {
      mapped = mapped.filter((u) => u.isBanned === filters.isBanned);
    }
    const filterRegion = filters.region;
    if (filterRegion) {
      mapped = mapped.filter((u) => u.region?.toLowerCase() === filterRegion.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      mapped = mapped.filter((u) => u.name.toLowerCase().includes(q) || u.phone.includes(q));
    }
    if (filters.createdAfter) {
      const after = new Date(filters.createdAfter);
      mapped = mapped.filter((u) => u.createdAt >= after);
    }
    if (filters.createdBefore) {
      const before = new Date(filters.createdBefore);
      mapped = mapped.filter((u) => u.createdAt <= before);
    }

    // Sort
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';

    mapped.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === 'createdAt') {
        valA = a.createdAt.getTime();
        valB = b.createdAt.getTime();
      } else if (sortBy === 'totalSpend') {
        valA = a.stats.totalSpend;
        valB = b.stats.totalSpend;
      } else if (sortBy === 'listingCount') {
        valA = a.stats.listingCount;
        valB = b.stats.listingCount;
      } else if (sortBy === 'avgRating') {
        valA = a.stats.avgRating;
        valB = b.stats.avgRating;
      } else {
        valA = a.createdAt.getTime();
        valB = b.createdAt.getTime();
      }

      if (sortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    const total = mapped.length;
    const limit = pagination.limit || 20;
    const page = pagination.page || 1;
    const skip = (page - 1) * limit;
    const paginated = mapped.slice(skip, skip + limit);

    return {
      users: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves full profile detail for a single user.
   */
  public static async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transportProfile: true,
        ban: true,
      },
    });

    if (!user) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Role-specific activities
    let listings: any[] = [];
    let orders: any[] = [];
    let deliveries: any[] = [];

    if (user.role === Role.FARMER) {
      listings = await prisma.produceListing.findMany({
        where: { farmerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } else if (user.role === Role.BUYER) {
      orders = await prisma.order.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } else if (user.role === Role.TRANSPORT) {
      deliveries = await prisma.deliveryRequest.findMany({
        where: { transportProviderId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    // Reviews given and received
    const [sentReviews, receivedReviews] = await Promise.all([
      prisma.review.findMany({
        where: { fromUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { toUser: { select: { id: true, name: true } } },
      }),
      prisma.review.findMany({
        where: { toUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { fromUser: { select: { id: true, name: true } } },
      }),
    ]);

    // Audit logs actor or target
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { actorId: userId },
          { targetType: 'User', targetId: userId },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    return {
      user,
      activeBan: user.ban && user.ban.isActive ? user.ban : null,
      activities: {
        listings,
        orders,
        deliveries,
      },
      reviews: {
        sent: sentReviews,
        received: receivedReviews,
      },
      auditLogs,
    };
  }

  /**
   * Suspends a user.
   */
  public static async banUser(actorId: string, userId: string, reason: string, expiresAt?: string) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (targetUser.role === Role.SUPERADMIN) {
      throw createError('Cannot ban another SUPERADMIN', 'FORBIDDEN_ACTION', 403);
    }

    const ban = await prisma.userBan.upsert({
      where: { userId },
      create: {
        userId,
        bannedBy: actorId,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
      update: {
        bannedBy: actorId,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        bannedAt: new Date(),
      },
    });

    await NotificationService.createNotification(
      userId,
      'ACCOUNT_SUSPENDED',
      `Your account has been suspended. Reason: ${reason}. Contact support to appeal.`,
      true
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'USER_BANNED',
      targetType: 'User',
      targetId: userId,
      metadata: { reason, expiresAt },
    });

    return ban;
  }

  /**
   * Re-enables a suspended user.
   */
  public static async unbanUser(actorId: string, userId: string) {
    const ban = await prisma.userBan.findUnique({ where: { userId } });
    if (!ban || !ban.isActive) {
      throw createError('User is not banned or suspension already lifted', 'BAD_REQUEST', 400);
    }

    const updatedBan = await prisma.userBan.update({
      where: { userId },
      data: { isActive: false },
    });

    await NotificationService.createNotification(
      userId,
      'ACCOUNT_UNBANNED',
      'Your account suspension has been lifted.',
      true
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'USER_UNBANNED',
      targetType: 'User',
      targetId: userId,
    });

    return updatedBan;
  }

  /**
   * Promotes a user to ADMIN role.
   */
  public static async promoteToAdmin(actorId: string, userId: string) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (targetUser.role === Role.ADMIN) {
      throw createError('User is already an ADMIN', 'BAD_REQUEST', 400);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });

    await NotificationService.createNotification(
      userId,
      'PROMOTED_TO_ADMIN',
      'You have been granted admin access on AgriConnect.',
      true
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'USER_PROMOTED_TO_ADMIN',
      targetType: 'User',
      targetId: userId,
    });

    return updatedUser;
  }

  /**
   * Reverts an administrator back to their profile role.
   */
  public static async demoteAdmin(actorId: string, userId: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        farmerProfile: true,
        buyerProfile: true,
        transportProfile: true,
      },
    });

    if (!targetUser) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    if (targetUser.role !== Role.ADMIN) {
      throw createError('User is not an ADMIN', 'BAD_REQUEST', 400);
    }

    let backRole: Role = Role.BUYER;
    if (targetUser.farmerProfile) {
      backRole = Role.FARMER;
    } else if (targetUser.transportProfile) {
      backRole = Role.TRANSPORT;
    } else if (targetUser.buyerProfile) {
      backRole = Role.BUYER;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: backRole },
    });

    await NotificationService.createNotification(
      userId,
      'ADMIN_DEMOTED',
      'Your admin privileges have been revoked.',
      true
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'ADMIN_DEMOTED',
      targetType: 'User',
      targetId: userId,
      metadata: { demotedTo: backRole },
    });

    return updatedUser;
  }

  /**
   * Force verfies a user.
   */
  public static async forceVerifyUser(actorId: string, userId: string) {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });

    await NotificationService.createNotification(
      userId,
      'ACCOUNT_VERIFIED',
      'Your account has been verified by the administrator.',
      false
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'USER_FORCE_VERIFIED',
      targetType: 'User',
      targetId: userId,
    });

    return updatedUser;
  }

  /**
   * Impersonates a target user by returning a read-only JWT session token.
   */
  public static async impersonateUser(actorId: string, targetUserId: string) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw createError('User not found', 'USER_NOT_FOUND', 404);
    }

    const impersonationToken = jwt.sign(
      {
        userId: targetUserId,
        role: targetUser.role,
        impersonatedBy: actorId,
      },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'USER_IMPERSONATED',
      targetType: 'User',
      targetId: targetUserId,
    });

    return { impersonationToken };
  }
}
