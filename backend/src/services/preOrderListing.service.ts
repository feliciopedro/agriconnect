import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { NotificationService } from './notification.service';
import { PreOrderService } from './preorder.service';
import { SmsOutboundService } from './ussd/smsOutbound.service';
import { CropType, ListingStatus, TraceEventType } from '../prisma/generated-client';

export class PreOrderListingService {
  /**
   * Creates a pre-order listing (upcoming planting plan) for a farmer.
   */
  public static async createPreOrderListing(
    farmerId: string,
    data: {
      cropType: CropType;
      quantityKg: number;
      pricePerKg: number;
      harvestDate: Date;
      minimumKg?: number;
    }
  ) {
    const farmer = await prisma.user.findUnique({
      where: { id: farmerId }
    });

    if (!farmer) {
      throw createError('Farmer not found', 'FARMER_NOT_FOUND', 404);
    }

    const batchCode = `PLN-${data.cropType}-${Date.now().toString().slice(-4)}`;

    const listing = await prisma.produceListing.create({
      data: {
        farmerId,
        cropType: data.cropType,
        quantityKg: data.quantityKg,
        remainingKg: data.quantityKg,
        pricePerKg: data.pricePerKg,
        harvestDate: data.harvestDate,
        status: ListingStatus.AVAILABLE, // we'll use AVAILABLE as the baseline status
        latitude: farmer.latitude || 6.0940,
        longitude: farmer.longitude || -0.2590,
        batchCode,
        images: []
      }
    });

    // Create a traceability record for the plan
    await prisma.traceabilityRecord.create({
      data: {
        listingId: listing.id,
        plantingDate: new Date(),
        inputsUsed: data.minimumKg ? [`Minimum quantity per buyer: ${data.minimumKg}kg`] : []
      }
    });

    // Log trace event
    await prisma.traceEvent.create({
      data: {
        listingId: listing.id,
        eventType: TraceEventType.LISTED,
        recordedByUserId: farmerId,
        notes: `Planting plan registered: ${data.quantityKg}kg of ${data.cropType}`
      }
    });

    return listing;
  }

  /**
   * Publishes the pre-order listing and matches it against open pre-orders.
   */
  public static async publishPreOrderListing(listingId: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
      include: { farmer: true }
    });

    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    // Call DemandSignalService matcher to link open pre-orders and notify buyers
    const { DemandSignalService } = require('./demandSignal.service');
    await DemandSignalService.matchDemandSignalToListing(listing);

    try {
      const matchedPreOrders = await prisma.preOrder.findMany({
        where: { matchedListingId: listingId, status: 'MATCHED' }
      });
      if (matchedPreOrders.length > 0) {
        await SmsOutboundService.sendSms(listing.farmer.phone, 'deposit_threshold_met', {
          crop: listing.cropType,
          N: matchedPreOrders.length
        });
      }
    } catch (smsErr) {
      console.error('Failed to send deposit threshold met SMS:', smsErr);
    }

    return { success: true };
  }

  /**
   * Confirms planting of the pre-ordered crop, linking a PlantingLog.
   */
  public static async confirmPlanting(listingId: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    // Create PlantingLog
    const log = await prisma.plantingLog.create({
      data: {
        farmerId: listing.farmerId,
        cropType: listing.cropType,
        acreage: 1.0,
        plantingDate: new Date(),
        expectedHarvestDate: listing.harvestDate,
        notes: 'Planting confirmed via USSD.'
      }
    });

    // Link log to listing
    await prisma.produceListing.update({
      where: { id: listingId },
      data: { plantingLogId: log.id }
    });

    // Add trace event
    await prisma.traceEvent.create({
      data: {
        listingId,
        eventType: TraceEventType.LISTED,
        notes: 'Crops planted and linked to planting log.'
      }
    });

    return log;
  }

  /**
   * Posts an growing/field status update.
   */
  public static async updateGrowingStatus(listingId: string, notes: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId }
    });

    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    if (listing.plantingLogId) {
      await prisma.plantingLog.update({
        where: { id: listing.plantingLogId },
        data: { notes }
      });
    }

    // Insert trace event
    await prisma.traceEvent.create({
      data: {
        listingId,
        eventType: TraceEventType.LISTED,
        notes: `Growing update: ${notes}`
      }
    });

    return { success: true };
  }

  /**
   * Marks harvest ready, notifying all matched buyers.
   */
  public static async markHarvestReady(listingId: string) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
      include: {
        preOrders: {
          include: { buyer: true }
        }
      }
    });

    if (!listing) {
      throw createError('Listing not found', 'LISTING_NOT_FOUND', 404);
    }

    // Log harvest trace event
    await prisma.traceEvent.create({
      data: {
        listingId,
        eventType: TraceEventType.HARVESTED,
        notes: 'Crops harvested and ready for fulfillment.'
      }
    });

    // Update actual harvest date in planting log if any
    if (listing.plantingLogId) {
      await prisma.plantingLog.update({
        where: { id: listing.plantingLogId },
        data: { actualHarvestDate: new Date(), actualYieldKg: listing.quantityKg }
      });
    }

    // Notify buyers who placed deposit
    for (const po of listing.preOrders) {
      if (po.depositPaid) {
        await NotificationService.createNotification(
          po.buyerId,
          'PREORDER_HARVEST_READY',
          `Your pre-ordered ${listing.cropType} from farmer is harvested and ready!`,
          true // Send SMS
        );
      }
    }

    return { success: true };
  }
}
