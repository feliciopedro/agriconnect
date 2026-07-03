import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { TraceEventType, OrderStatus } from '../prisma/generated-client';

export class TraceService {
  /**
   * Fetches the complete crop traceability timeline by batchCode.
   * Omits sensitive farmer contact details and buyer names to respect privacy.
   */
  public static async getTraceByBatchCode(batchCode: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { batchCode },
      include: {
        farmer: {
          select: {
            name: true,
            region: true,
            district: true,
          },
        },
        traceability: true,
        traceEvents: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!listing) {
      throw createError(`Crop batch code ${batchCode} not found`, 'BATCH_NOT_FOUND', 404);
    }

    // Check if an order linked to this listing has been successfully DELIVERED
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
      // Get the timestamp of the DELIVERED trace event
      const deliveredEvent = listing.traceEvents.find(
        (e) => e.eventType === TraceEventType.DELIVERED
      );
      
      deliveryInfo = {
        deliveredAt: deliveredEvent ? deliveredEvent.timestamp : deliveredOrder.updatedAt,
        buyerType: deliveredOrder.buyer?.buyerProfile?.businessType || null,
      };
    }

    return {
      id: listing.id,
      status: listing.status,
      batchCode: listing.batchCode,
      cropType: listing.cropType,
      qualityGrade: listing.qualityGrade,
      farmer: {
        name: listing.farmer.name,
        region: listing.farmer.region,
        district: listing.farmer.district,
      },
      latitude: listing.latitude,
      longitude: listing.longitude,
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
   * Allows administrators to manually inject an override event in the audit trail.
   */
  public static async addAdminTraceEvent(
    batchCode: string,
    eventType: TraceEventType,
    notes: string,
    adminUserId: string
  ) {
    const listing = await prisma.produceListing.findUnique({
      where: { batchCode },
    });

    if (!listing) {
      throw createError(`Crop batch code ${batchCode} not found`, 'BATCH_NOT_FOUND', 404);
    }

    return await prisma.traceEvent.create({
      data: {
        listingId: listing.id,
        eventType,
        notes: `${notes} (manually inserted by admin)`,
        recordedByUserId: adminUserId,
        latitude: listing.latitude,
        longitude: listing.longitude,
      },
    });
  }
}
