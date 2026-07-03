import prisma from '../../prisma/client';
import { Role, OrderStatus, DeliveryStatus, ListingStatus, TraceEventType, QualityGrade, PaymentStatus } from '../../prisma/generated-client';
import { createError } from '../../utils/errors';
import { AuditLogService } from '../audit.service';
import { NotificationService } from '../notification.service';

export class SuperAdminContentService {
  /**
   * Retrieves all listings with filters, sorting, and pagination.
   */
  public static async getAllListings(
    filters: {
      cropType?: string;
      status?: string;
      qualityGrade?: string;
      farmerId?: string;
      region?: string;
      spoilageRisk?: 'high' | 'critical';
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
    const listings = await prisma.produceListing.findMany({
      include: {
        farmer: { select: { id: true, name: true, phone: true, region: true } },
        orders: {
          where: { status: { not: OrderStatus.CANCELLED } },
          select: { id: true },
        },
      },
    });

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    let mapped = listings.map((l) => {
      let riskBand: 'none' | 'low' | 'high' | 'critical' = 'none';
      if (l.expiryEstimate) {
        const exp = new Date(l.expiryEstimate);
        if (exp <= oneDayFromNow) {
          riskBand = 'critical';
        } else if (exp <= threeDaysFromNow) {
          riskBand = 'high';
        } else {
          riskBand = 'low';
        }
      }

      return {
        id: l.id,
        cropType: l.cropType,
        quantityKg: l.quantityKg,
        remainingKg: l.remainingKg,
        pricePerKg: l.pricePerKg,
        harvestDate: l.harvestDate,
        expiryEstimate: l.expiryEstimate,
        qualityGrade: l.qualityGrade,
        qualityGradeSource: l.qualityGradeSource,
        status: l.status,
        batchCode: l.batchCode,
        createdAt: l.createdAt,
        farmerName: l.farmer?.name || 'Unknown',
        farmerPhone: l.farmer?.phone || 'Unknown',
        farmerRegion: l.farmer?.region || 'Unknown',
        orderCount: l.orders.length,
        spoilageRisk: riskBand,
      };
    });

    // Apply filters
    if (filters.cropType) {
      mapped = mapped.filter((l) => l.cropType === filters.cropType);
    }
    if (filters.status) {
      mapped = mapped.filter((l) => l.status === filters.status);
    }
    if (filters.qualityGrade) {
      mapped = mapped.filter((l) => l.qualityGrade === filters.qualityGrade);
    }
    if (filters.farmerId) {
      mapped = mapped.filter((l) => l.farmerPhone === filters.farmerId || l.id === filters.farmerId); // can match farmerId/phone
    }
    if (filters.region) {
      mapped = mapped.filter((l) => l.farmerRegion.toLowerCase() === filters.region!.toLowerCase());
    }
    if (filters.spoilageRisk) {
      if (filters.spoilageRisk === 'critical') {
        mapped = mapped.filter((l) => l.spoilageRisk === 'critical');
      } else if (filters.spoilageRisk === 'high') {
        mapped = mapped.filter((l) => l.spoilageRisk === 'critical' || l.spoilageRisk === 'high');
      }
    }
    if (filters.createdAfter) {
      const after = new Date(filters.createdAfter);
      mapped = mapped.filter((l) => l.createdAt >= after);
    }
    if (filters.createdBefore) {
      const before = new Date(filters.createdBefore);
      mapped = mapped.filter((l) => l.createdAt <= before);
    }

    // Sort
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';

    mapped.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === 'pricePerKg') {
        valA = a.pricePerKg;
        valB = b.pricePerKg;
      } else if (sortBy === 'remainingKg') {
        valA = a.remainingKg;
        valB = b.remainingKg;
      } else if (sortBy === 'expiryEstimate') {
        valA = a.expiryEstimate ? new Date(a.expiryEstimate).getTime() : 0;
        valB = b.expiryEstimate ? new Date(b.expiryEstimate).getTime() : 0;
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
      listings: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single listing detail.
   */
  public static async getListingDetail(listingId: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
      include: {
        farmer: { select: { id: true, name: true, phone: true, region: true } },
        traceability: true,
        traceEvents: {
          orderBy: { timestamp: 'desc' },
        },
        orders: {
          select: { id: true, quantityKg: true, totalPrice: true, status: true, buyer: { select: { name: true } } },
        },
      },
    });

    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    return listing;
  }

  /**
   * Deactivates listing by setting status to EXPIRED.
   */
  public static async removeListing(actorId: string, listingId: string, reason: string) {
    const listing = await prisma.produceListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    const updatedListing = await prisma.produceListing.update({
      where: { id: listingId },
      data: { status: ListingStatus.EXPIRED },
    });

    await prisma.traceEvent.create({
      data: {
        listingId,
        eventType: TraceEventType.LISTED,
        notes: `Removed by platform admin: ${reason}`,
      },
    });

    await NotificationService.createNotification(
      listing.farmerId,
      'LISTING_REMOVED',
      `Your listing (${listing.batchCode}) has been removed by the platform. Reason: ${reason}. Contact support to appeal.`,
      true
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'LISTING_REMOVED',
      targetType: 'ProduceListing',
      targetId: listingId,
      metadata: { reason },
    });

    return updatedListing;
  }

  /**
   * Overrides listing quality grade.
   */
  public static async overrideListingQuality(actorId: string, listingId: string, grade: QualityGrade, reason: string) {
    const listing = await prisma.produceListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    const updatedListing = await prisma.produceListing.update({
      where: { id: listingId },
      data: {
        qualityGrade: grade,
        qualityGradeSource: 'ADMIN_OVERRIDE',
      },
    });

    await prisma.traceEvent.create({
      data: {
        listingId,
        eventType: TraceEventType.QUALITY_CHECKED,
        notes: `Quality grade overridden by platform admin: ${grade}. Reason: ${reason}`,
      },
    });

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'LISTING_QUALITY_OVERRIDDEN',
      targetType: 'ProduceListing',
      targetId: listingId,
      metadata: { grade, reason },
    });

    return updatedListing;
  }

  /**
   * Retrieves all orders with filters, sorting, and pagination.
   */
  public static async getAllOrders(
    filters: {
      status?: string;
      paymentStatus?: string;
      buyerId?: string;
      farmerId?: string;
      region?: string;
      minValue?: number;
      maxValue?: number;
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
    const orders = await prisma.order.findMany({
      include: {
        buyer: { select: { id: true, name: true, region: true } },
        listing: {
          include: {
            farmer: { select: { id: true, name: true, region: true } },
          },
        },
        deliveryRequest: { select: { status: true } },
      },
    });

    let mapped = orders.map((o) => ({
      id: o.id,
      buyerId: o.buyerId,
      buyerName: o.buyer?.name || 'Unknown',
      buyerRegion: o.buyer?.region || 'Unknown',
      farmerId: o.listing?.farmerId || 'Unknown',
      farmerName: o.listing?.farmer?.name || 'Unknown',
      cropType: o.listing?.cropType || 'Unknown',
      quantityKg: o.quantityKg,
      totalPrice: o.totalPrice,
      status: o.status,
      paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryRequest?.status || 'NOT_REQUESTED',
      createdAt: o.createdAt,
    }));

    // Apply filters
    if (filters.status) {
      mapped = mapped.filter((o) => o.status === filters.status);
    }
    if (filters.paymentStatus) {
      mapped = mapped.filter((o) => o.paymentStatus === filters.paymentStatus);
    }
    if (filters.buyerId) {
      mapped = mapped.filter((o) => o.buyerId === filters.buyerId);
    }
    if (filters.farmerId) {
      mapped = mapped.filter((o) => o.farmerId === filters.farmerId);
    }
    if (filters.region) {
      mapped = mapped.filter((o) => o.buyerRegion.toLowerCase() === filters.region!.toLowerCase());
    }
    if (filters.minValue !== undefined) {
      mapped = mapped.filter((o) => o.totalPrice >= filters.minValue!);
    }
    if (filters.maxValue !== undefined) {
      mapped = mapped.filter((o) => o.totalPrice <= filters.maxValue!);
    }
    if (filters.createdAfter) {
      const after = new Date(filters.createdAfter);
      mapped = mapped.filter((o) => o.createdAt >= after);
    }
    if (filters.createdBefore) {
      const before = new Date(filters.createdBefore);
      mapped = mapped.filter((o) => o.createdAt <= before);
    }

    // Sort
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';

    mapped.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === 'totalPrice') {
        valA = a.totalPrice;
        valB = b.totalPrice;
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
      orders: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves single order detail.
   */
  public static async getOrderDetail(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        listing: {
          include: {
            farmer: true,
            traceEvents: {
              orderBy: { timestamp: 'desc' },
            },
          },
        },
        deliveryRequest: true,
        reviews: true,
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    // Fetch messages between the parties linked to this orderId
    const messages = await prisma.message.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      order,
      messages,
    };
  }

  /**
   * Force cancels order by superadmin.
   */
  public static async cancelOrderAdmin(actorId: string, orderId: string, reason: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Force cancel the order
      const ord = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: order.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : order.paymentStatus,
          // TODO: Integrate actual Paystack refunds API call here.
        },
      });

      // 2. Restore listing remainingKg
      await tx.produceListing.update({
        where: { id: order.listingId },
        data: {
          remainingKg: { increment: order.quantityKg },
          status: ListingStatus.AVAILABLE, // ensure re-opened if it was SOLD_OUT
        },
      });

      return ord;
    });

    // Notify farmer and buyer
    await NotificationService.createNotification(
      order.buyerId,
      'ORDER_CANCELLED',
      `Your order for ${order.listing.cropType} has been cancelled by platform admin. Reason: ${reason}`,
      true
    );

    await NotificationService.createNotification(
      order.listing.farmerId,
      'ORDER_CANCELLED',
      `Buyer order ${orderId.slice(0, 8)} has been cancelled by platform admin. Reason: ${reason}`,
      true
    );

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'ORDER_CANCELLED_BY_ADMIN',
      targetType: 'Order',
      targetId: orderId,
      metadata: { reason },
    });

    return updatedOrder;
  }
}
