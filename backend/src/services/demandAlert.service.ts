import prisma from '../prisma/client';
import { CropType } from '../prisma/generated-client';
import { createError } from '../utils/errors';
import { NotificationService } from './notification.service';
import { SmsOutboundService } from './ussd/smsOutbound.service';

export class DemandAlertService {
  /**
   * Create or update a crop alert for a buyer.
   */
  public static async createAlert(
    buyerId: string,
    data: {
      cropType: CropType;
      minQuantityKg?: number;
      maxPricePerKg?: number;
      region?: string;
    }
  ) {
    const minQty = data.minQuantityKg ? parseFloat(data.minQuantityKg as any) : null;
    const maxPrice = data.maxPricePerKg ? parseFloat(data.maxPricePerKg as any) : null;
    const region = data.region && data.region.trim() !== '' ? data.region.trim() : null;

    // Create or update subscription criteria
    return await (prisma as any).buyerCropAlert.upsert({
      where: {
        buyerId_cropType: {
          buyerId,
          cropType: data.cropType,
        },
      },
      update: {
        minQuantityKg: minQty,
        maxPricePerKg: maxPrice,
        region,
        isActive: true,
      },
      create: {
        buyerId,
        cropType: data.cropType,
        minQuantityKg: minQty,
        maxPricePerKg: maxPrice,
        region,
        isActive: true,
      },
    });
  }

  /**
   * Fetch configured alerts for a specific buyer.
   */
  public static async getAlertsByBuyer(buyerId: string) {
    return await (prisma as any).buyerCropAlert.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Toggle crop alert active status.
   */
  public static async toggleAlert(alertId: string, buyerId: string, isActive: boolean) {
    const alert = await (prisma as any).buyerCropAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw createError('Alert subscription not found', 'ALERT_NOT_FOUND', 404);
    }

    if (alert.buyerId !== buyerId) {
      throw createError('Unauthorized to modify this subscription', 'UNAUTHORIZED', 403);
    }

    return await (prisma as any).buyerCropAlert.update({
      where: { id: alertId },
      data: { isActive },
    });
  }

  /**
   * Matches configured alerts against a newly created listing and fires notifications.
   */
  public static async processNewListingAlerts(listing: {
    id: string;
    cropType: CropType;
    quantityKg: number;
    pricePerKg: number;
    region?: string | null;
    farmer?: { name?: string };
    farmerId: string;
  }) {
    console.log(`🔍 Scanning Crop Alert matches for listing ID: ${listing.id}...`);

    // Fetch all active alerts matching this crop type
    const activeAlerts = await (prisma as any).buyerCropAlert.findMany({
      where: {
        cropType: listing.cropType,
        isActive: true,
      },
      include: {
        buyer: { select: { id: true, phone: true } },
      },
    });

    const listingRegion = listing.region || null;
    let matchCount = 0;

    for (const alert of activeAlerts) {
      // 1. Min Quantity check
      if (alert.minQuantityKg !== null && listing.quantityKg < alert.minQuantityKg) {
        continue;
      }

      // 2. Max Price check
      if (alert.maxPricePerKg !== null && listing.pricePerKg > alert.maxPricePerKg) {
        continue;
      }

      // 3. Region check (case-insensitive if both exist)
      if (alert.region && listingRegion) {
        if (alert.region.toLowerCase() !== listingRegion.toLowerCase()) {
          continue;
        }
      } else if (alert.region && !listingRegion) {
        // subscription has region but listing does not -> mismatch
        continue;
      }

      // Trigger notification dispatch
      try {
        const cropName = listing.cropType.replace('_', ' ');
        const notificationText = `🔔 Crop Match! A new listing of ${listing.quantityKg}kg ${cropName} was posted at GHS ${listing.pricePerKg}/kg${listingRegion ? ` in ${listingRegion}` : ''}. Check AgriConnect to buy now!`;

        // Create in-app notification
        await NotificationService.createNotification(
          alert.buyerId,
          'CROP_ALERT_MATCHED',
          notificationText,
          false // do not trigger standard SMS outbound inside createNotification directly, we handle it below using translated templates
        );

        // Dispatch SMS Alert using templates
        await SmsOutboundService.sendSms(alert.buyer.phone, 'crop_alert_match', {
          crop: cropName,
          qty: listing.quantityKg,
          price: listing.pricePerKg.toFixed(2),
          region: listingRegion || 'Ghana',
        });

        matchCount++;
      } catch (err) {
        console.error(`Failed to dispatch alert notification to buyer ${alert.buyerId}:`, err);
      }
    }

    if (matchCount > 0) {
      console.log(`✅ Automated Alerts: Sent ${matchCount} crop alert match notices for listing ${listing.id}`);
    }
  }
}
