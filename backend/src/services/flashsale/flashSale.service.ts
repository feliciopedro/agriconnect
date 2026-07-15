import prisma from '../../prisma/client';
import { createError } from '../../utils/errors';
import { SpoilageRiskService } from './spoilageRisk.service';
import { SPOILAGE_CONFIG } from '../../config/spoilage.config';
import { config } from '../../config';
import { OrderService } from '../order.service';
import { SmsOutboundService } from '../ussd/smsOutbound.service';
import { Role, ListingStatus } from '../../prisma/generated-client';

export class FlashSaleService {
  /**
   * Creates a flash sale for a listing if risk conditions are met.
   */
  public static async createFlashSale(
    listingId: string,
    triggerSource: 'AUTO_JOB' | 'FARMER_MANUAL' | 'ADMIN',
    overrideDiscount?: number
  ) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: listingId },
      include: { farmer: true },
    });

    if (!listing) {
      throw createError('Produce listing not found', 'NOT_FOUND', 404);
    }

    if (listing.status !== 'AVAILABLE') {
      throw createError('Listing is not available for a flash sale', 'INVALID_STATUS', 400);
    }

    if (listing.remainingKg < SPOILAGE_CONFIG.MIN_REMAINING_KG) {
      throw createError(
        `Listing quantity is below minimum (${SPOILAGE_CONFIG.MIN_REMAINING_KG}kg) for flash sale`,
        'INSUFFICIENT_QUANTITY',
        400
      );
    }

    if (listing.activeFlashSaleId) {
      throw createError('A flash sale is already active for this listing', 'CONFLICT', 409);
    }

    // Clear out any old inactive flash sale records (expired/cancelled/sold) for this listing
    await (prisma as any).flashSale.deleteMany({
      where: { listingId }
    });

    const risk = SpoilageRiskService.calculateRiskScore(listing);

    if (triggerSource === 'AUTO_JOB' && risk.band !== 'HIGH' && risk.band !== 'CRITICAL') {
      return null;
    }

    const discountPercent =
      overrideDiscount ??
      SPOILAGE_CONFIG.DISCOUNT_BY_BAND[risk.band as 'HIGH' | 'CRITICAL'] ??
      15;

    const flashPricePerKg = parseFloat((listing.pricePerKg * (1 - discountPercent / 100)).toFixed(2));

    const windowHours = SPOILAGE_CONFIG.FLASH_SALE_WINDOW_HOURS[risk.band as 'HIGH' | 'CRITICAL'] ?? 8;
    const expiresAt = new Date(Date.now() + windowHours * 60 * 60 * 1000);

    const farmerApproved = triggerSource === 'FARMER_MANUAL';

    const flashSale = await (prisma as any).flashSale.create({
      data: {
        listingId,
        farmerId: listing.farmerId,
        originalPricePerKg: listing.pricePerKg,
        discountPercent,
        flashPricePerKg,
        quantityKg: listing.remainingKg,
        riskBand: risk.band,
        riskScore: risk.score,
        status: 'ACTIVE',
        expiresAt,
        farmerApproved,
      },
    });

    await prisma.produceListing.update({
      where: { id: listingId },
      data: {
        activeFlashSaleId: flashSale.id,
        currentRiskBand: risk.band,
        currentRiskScore: risk.score,
        lastRiskCalculatedAt: new Date(),
      },
    });

    await (prisma as any).spoilageRiskLog.create({
      data: {
        listingId,
        previousBand: listing.currentRiskBand,
        newBand: risk.band,
        riskScore: risk.score,
        hoursUntilExpiry: risk.hoursUntilExpiry,
        remainingKg: listing.remainingKg,
        triggeredFlashSale: true,
      },
    });

    if (!farmerApproved) {
      const smsMsg = `⚠ Your ${listing.remainingKg}kg ${listing.cropType.replace(
        '_',
        ' '
      )} is at risk of spoiling in ${risk.hoursUntilExpiry}h. A flash sale has been created at GHS ${flashPricePerKg}/kg (was GHS ${listing.pricePerKg}/kg). Nearby buyers are being notified. Dial *920*11# or open the app to cancel.`;

      await prisma.notification.create({
        data: {
          userId: listing.farmerId,
          message: `[⚠️ Auto Flash Sale Triggered] ${smsMsg}`,
          type: 'SYSTEM',
        },
      });

      try {
        await SmsOutboundService.sendSms(
          listing.farmer.phone,
          'flash_sale_auto_farmer',
          {
            qty: listing.remainingKg,
            crop: listing.cropType.replace('_', ' '),
            hours: risk.hoursUntilExpiry,
            flashPrice: flashPricePerKg,
            original: listing.pricePerKg,
          }
        );
      } catch (err) {
        console.error('Failed to send SMS to farmer:', err);
      }
    }

    this.notifyNearbyBuyers(flashSale).catch((err) =>
      console.error('Failed to notify nearby buyers:', err)
    );

    return flashSale;
  }

  /**
   * Geographic alert notification dispatcher.
   */
  public static async notifyNearbyBuyers(flashSale: any) {
    const listing = await prisma.produceListing.findUnique({
      where: { id: flashSale.listingId },
      include: { farmer: true },
    });

    if (!listing) return;

    const lat = listing.latitude;
    const lng = listing.longitude;

    // Haversine raw SQL query to locate buyers within radius
    const buyersInRadius = await prisma.$queryRaw<any[]>`
      SELECT id, phone, name, "flashSaleRadius",
             (6371 * acos(cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng})) + sin(radians(${lat})) * sin(radians("latitude")))) AS distance_km
      FROM "User"
      WHERE "role" = 'BUYER'
        AND "flashSaleOptOut" = false
        AND "latitude" IS NOT NULL
        AND "longitude" IS NOT NULL
        AND (6371 * acos(cos(radians(${lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${lng})) + sin(radians(${lat})) * sin(radians("latitude")))) <= COALESCE("flashSaleRadius", ${SPOILAGE_CONFIG.NOTIFICATION_RADIUS_KM})
    `;

    if (buyersInRadius.length === 0) return;

    const buyerIdsInRadius = buyersInRadius.map((b) => b.id);

    // Filter to buyers who have ordered this cropType before
    const buyersWithHistory = await prisma.user.findMany({
      where: {
        id: { in: buyerIdsInRadius },
        orders: {
          some: {
            listing: {
              cropType: listing.cropType,
            },
          },
        },
      },
    });

    // Handle cold-start problem
    const targetedBuyers =
      buyersWithHistory.length >= 10
        ? buyersInRadius.filter((b) => buyersWithHistory.some((bh) => bh.id === b.id))
        : buyersInRadius;

    // Cap at max 50 buyers
    const finalBuyers = targetedBuyers.slice(0, 50);

    let sentCount = 0;
    for (const buyer of finalBuyers) {
      const distance = buyer.distance_km || 0;
      const formattedExpires = new Date(flashSale.expiresAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // a. Create FlashSaleNotification record
      const notifRecord = await (prisma as any).flashSaleNotification.create({
        data: {
          flashSaleId: flashSale.id,
          buyerId: buyer.id,
          channel: 'SMS',
          status: 'QUEUED',
        },
      });

      // b. Create in-app Notification
      const hoursRemaining = Math.max(
        0,
        Math.round((new Date(flashSale.expiresAt).getTime() - Date.now()) / 3600000)
      );
      await prisma.notification.create({
        data: {
          userId: buyer.id,
          message: `🔥 Flash sale: ${flashSale.quantityKg}kg ${listing.cropType.replace(
            '_',
            ' '
          )} near you — GHS${flashSale.flashPricePerKg}/kg (was GHS${
            flashSale.originalPricePerKg
          }/kg). ${hoursRemaining}h left. Tap to claim.`,
          type: 'PRODUCE_ALERT',
        },
      });

      // c. Send SMS
      if (buyer.phone) {
        try {
          const smsMessage = `AgriConnect Flash Sale! ${flashSale.quantityKg}kg ${listing.cropType.replace(
            '_',
            ' '
          )} ${parseFloat(distance.toFixed(1))}km away. GHS${flashSale.flashPricePerKg}/kg (was GHS${
            flashSale.originalPricePerKg
          }). Expires ${formattedExpires}. Order: ${config.FRONTEND_URL}/flash/${flashSale.id}`;

          if (
            config.AFRICAS_TALKING_API_KEY &&
            config.AFRICAS_TALKING_API_KEY !== 'mock_africas_talking_api_key'
          ) {
            const AfricasTalkingLib = require('africastalking');
            const at = AfricasTalkingLib({
              apiKey: config.AFRICAS_TALKING_API_KEY,
              username: config.AFRICAS_TALKING_USERNAME || 'sandbox',
            });
            await at.SMS.send({
              to: [buyer.phone],
              message: smsMessage,
            });
          } else {
            console.log(`[DEV SMS] to ${buyer.phone}: ${smsMessage}`);
          }

          // Create ussdShortMessage row as well
          await prisma.ussdShortMessage.create({
            data: {
              toPhone: buyer.phone,
              message: smsMessage,
              triggerAction: 'flash_sale_buyer_sms',
              status: 'SENT',
            },
          });

          await (prisma as any).flashSaleNotification.update({
            where: { id: notifRecord.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
            },
          });
          sentCount++;
        } catch (err) {
          console.error(`Failed to send SMS to buyer ${buyer.phone}:`, err);
          await (prisma as any).flashSaleNotification.update({
            where: { id: notifRecord.id },
            data: { status: 'FAILED' },
          });
        }
      }
    }

    // Update notificationsSent count
    await (prisma as any).flashSale.update({
      where: { id: flashSale.id },
      data: { notificationsSent: sentCount },
    });
  }

  /**
   * Claim stock reservation for a buyer.
   */
  public static async claimFlashSale(flashSaleId: string, buyerId: string, quantityKg: number) {
    const claim = await prisma.$transaction(async (tx) => {
      // Row lock using queryRaw
      const rows = await tx.$queryRaw<any[]>`
        SELECT * FROM "FlashSale" WHERE id = ${flashSaleId} FOR UPDATE
      `;
      const flashSale = rows[0];

      if (!flashSale) {
        throw createError('Flash sale not found', 'NOT_FOUND', 404);
      }

      if (flashSale.status !== 'ACTIVE') {
        throw createError('Flash sale is not active', 'INVALID_STATUS', 400);
      }

      if (new Date(flashSale.expiresAt).getTime() <= Date.now()) {
        throw createError('This flash sale has expired', 'EXPIRED', 410);
      }

      const remainingQty = flashSale.quantityKg - flashSale.soldKg;
      if (quantityKg > remainingQty) {
        throw createError('Insufficient quantity remaining', 'INSUFFICIENT_QUANTITY', 409);
      }

      const existingClaim = await tx.flashSaleClaim.findFirst({
        where: {
          flashSaleId,
          buyerId,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      });

      if (existingClaim) {
        throw createError('You have already claimed this flash sale', 'CONFLICT', 409);
      }

      const pricePerKg = flashSale.flashPricePerKg;
      const totalPrice = quantityKg * pricePerKg;
      const claimExpiry = new Date(Date.now() + SPOILAGE_CONFIG.CLAIM_EXPIRY_MINUTES * 60 * 1000);

      // Create claim
      const newClaim = await tx.flashSaleClaim.create({
        data: {
          flashSaleId,
          buyerId,
          quantityKg,
          pricePerKg,
          totalPrice,
          status: 'PENDING',
          expiresAt: claimExpiry,
        },
        include: {
          buyer: true,
          flashSale: true,
        },
      });

      const newSoldKg = flashSale.soldKg + quantityKg;
      const newBuyersClaimed = flashSale.buyersClaimed + 1;
      const newStatus = newSoldKg >= flashSale.quantityKg ? 'SOLD' : 'ACTIVE';

      await tx.flashSale.update({
        where: { id: flashSaleId },
        data: {
          soldKg: newSoldKg,
          buyersClaimed: newBuyersClaimed,
          status: newStatus,
        },
      });

      // Update listing capacity
      const listing = await tx.produceListing.findUnique({
        where: { id: flashSale.listingId },
      });
      if (listing) {
        const newListingRemaining = Math.max(0, listing.remainingKg - quantityKg);
        await tx.produceListing.update({
          where: { id: flashSale.listingId },
          data: {
            remainingKg: newListingRemaining,
            status: newListingRemaining <= 0 ? 'SOLD_OUT' : listing.status,
            activeFlashSaleId: newStatus === 'SOLD' ? null : listing.activeFlashSaleId,
          },
        });
      }

      return newClaim;
    });

    // Notify farmer outside transaction
    const listing = await prisma.produceListing.findUnique({
      where: { id: claim.flashSale.listingId },
      include: { farmer: true },
    });

    if (listing) {
      const remaining = Math.max(0, listing.remainingKg);
      const farmerMsg = `Flash sale claim! ${claim.buyer.name} claimed ${quantityKg}kg. ${remaining}kg remaining. GHS${claim.totalPrice} earned.`;

      await prisma.notification.create({
        data: {
          userId: listing.farmerId,
          message: `[💰 Flash Sale Claimed] ${farmerMsg}`,
          type: 'SYSTEM',
        },
      });

      try {
        await SmsOutboundService.sendSms(listing.farmer.phone, 'flash_sale_claimed_farmer', {
          buyerName: claim.buyer.name,
          qty: quantityKg,
          remaining,
          earnings: claim.totalPrice,
        });
      } catch (err) {
        console.error('Failed to notify farmer on claim:', err);
      }
    }

    return claim;
  }

  /**
   * Confirm buyer's claim and convert it to a real order.
   */
  public static async confirmClaim(claimId: string, buyerId: string) {
    const claim = await prisma.flashSaleClaim.findUnique({
      where: { id: claimId },
      include: { flashSale: true },
    });

    if (!claim) {
      throw createError('Flash sale claim not found', 'NOT_FOUND', 404);
    }

    if (claim.buyerId !== buyerId) {
      throw createError('Unauthorized to confirm this claim', 'UNAUTHORIZED', 403);
    }

    if (claim.status !== 'PENDING') {
      throw createError('Claim is not in PENDING state', 'INVALID_STATUS', 400);
    }

    if (new Date(claim.expiresAt).getTime() <= Date.now()) {
      throw createError('Claim payment window has expired', 'EXPIRED', 410);
    }

    // Create Order with FLASH_SALE source
    const order = await OrderService.createOrder(
      buyerId,
      claim.flashSale.listingId,
      claim.quantityKg,
      'FLASH_SALE'
    );

    // Update claim status
    await prisma.flashSaleClaim.update({
      where: { id: claimId },
      data: {
        status: 'CONFIRMED',
        orderId: order.id,
      },
    });

    return order;
  }

  /**
   * Release and expire a pending claim.
   */
  public static async expireClaim(claimId: string) {
    const claim = await prisma.flashSaleClaim.findUnique({
      where: { id: claimId },
      include: { flashSale: true, buyer: true },
    });

    if (!claim) {
      throw createError('Claim not found', 'NOT_FOUND', 404);
    }

    if (claim.status !== 'PENDING') {
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Set claim.status = EXPIRED
      await tx.flashSaleClaim.update({
        where: { id: claimId },
        data: { status: 'EXPIRED' },
      });

      // 2. Restore flashSale capacity
      const newSoldKg = Math.max(0, claim.flashSale.soldKg - claim.quantityKg);
      let newStatus = claim.flashSale.status;
      if (claim.flashSale.status === 'SOLD' && newSoldKg < claim.flashSale.quantityKg) {
        newStatus = 'ACTIVE';
      }

      await tx.flashSale.update({
        where: { id: claim.flashSaleId },
        data: {
          soldKg: newSoldKg,
          status: newStatus as any,
        },
      });

      // 3. Restore ProduceListing capacity
      const listing = await tx.produceListing.findUnique({
        where: { id: claim.flashSale.listingId },
      });
      if (listing) {
        const newRemaining = listing.remainingKg + claim.quantityKg;
        await tx.produceListing.update({
          where: { id: claim.flashSale.listingId },
          data: {
            remainingKg: newRemaining,
            status: 'AVAILABLE',
            activeFlashSaleId: newStatus === 'ACTIVE' ? claim.flashSaleId : listing.activeFlashSaleId,
          },
        });
      }
    });

    // 4. Notify buyer
    const buyerMsg = 'Your flash sale claim expired. The produce may still be available — check the marketplace.';
    await prisma.notification.create({
      data: {
        userId: claim.buyerId,
        message: `[⏳ Claim Expired] ${buyerMsg}`,
        type: 'SYSTEM',
      },
    });

    try {
      await SmsOutboundService.sendSms(claim.buyer.phone, 'flash_sale_claim_expired_buyer', {});
    } catch (err) {
      console.error('Failed to notify buyer on claim expiration:', err);
    }
  }

  /**
   * Closes a flash sale after its expiration time.
   */
  public static async expireFlashSale(flashSaleId: string) {
    const flashSale = await (prisma as any).flashSale.findUnique({
      where: { id: flashSaleId },
      include: { listing: { include: { farmer: true } } },
    });

    if (!flashSale || flashSale.status !== 'ACTIVE') {
      return;
    }

    // Determine current risk parameters
    const risk = SpoilageRiskService.calculateRiskScore(flashSale.listing);

    await prisma.$transaction(async (tx) => {
      // 1. Set flashSale.status = EXPIRED
      await (tx as any).flashSale.update({
        where: { id: flashSaleId },
        data: { status: 'EXPIRED' },
      });

      // 2. Clear activeFlashSaleId
      await tx.produceListing.update({
        where: { id: flashSale.listingId },
        data: {
          activeFlashSaleId: null,
          currentRiskBand: risk.band,
          currentRiskScore: risk.score,
        },
      });
    });

    const farmerId = flashSale.listing.farmerId;
    const phone = flashSale.listing.farmer.phone;

    if (flashSale.soldKg === 0) {
      const msg = 'Your flash sale ended without any claims. Consider a higher discount or contact support.';
      await prisma.notification.create({
        data: {
          userId: farmerId,
          message: `[⏳ Flash Sale Expired] ${msg}`,
          type: 'SYSTEM',
        },
      });

      try {
        await SmsOutboundService.sendSms(phone, 'flash_sale_expired_no_claims', {});
      } catch (err) {
        console.error('Failed to notify farmer on expiration:', err);
      }
    } else {
      const remaining = Math.max(0, flashSale.listing.remainingKg);
      const msg = `Your flash sale sold ${flashSale.soldKg}kg out of ${flashSale.quantityKg}kg. ${remaining}kg is still available at the original price.`;
      await prisma.notification.create({
        data: {
          userId: farmerId,
          message: `[📈 Flash Sale Summary] ${msg}`,
          type: 'SYSTEM',
        },
      });

      try {
        await SmsOutboundService.sendSms(phone, 'flash_sale_expired_partial', {
          soldKg: flashSale.soldKg,
          totalKg: flashSale.quantityKg,
          remainingKg: remaining,
        });
      } catch (err) {
        console.error('Failed to notify farmer on expiration:', err);
      }
    }
  }

  /**
   * Cancel an active flash sale.
   */
  public static async cancelFlashSale(flashSaleId: string, actorId: string, reason?: string) {
    const flashSale = await (prisma as any).flashSale.findUnique({
      where: { id: flashSaleId },
      include: {
        listing: { include: { farmer: true } },
        claims: { include: { buyer: true } },
      },
    });

    if (!flashSale) {
      throw createError('Flash sale not found', 'NOT_FOUND', 404);
    }

    // Verify actor: farmer or admin
    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) {
      throw createError('Actor not found', 'UNAUTHORIZED', 401);
    }

    const isFarmer = flashSale.farmerId === actorId;
    const isAdmin = actor.role === Role.ADMIN || actor.role === Role.SUPERADMIN;

    if (!isFarmer && !isAdmin) {
      throw createError('Unauthorized to cancel this flash sale', 'UNAUTHORIZED', 403);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Set status = CANCELLED
      await (tx as any).flashSale.update({
        where: { id: flashSaleId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason || 'Cancelled by actor',
        },
      });

      // 2. Reset listing's activeFlashSaleId
      // and restore the unsold reserved capacity (sold but pending claims)
      let restoreQty = 0;
      const pendingClaims = flashSale.claims.filter((c: any) => c.status === 'PENDING');
      for (const claim of pendingClaims) {
        restoreQty += claim.quantityKg;
        await tx.flashSaleClaim.update({
          where: { id: claim.id },
          data: { status: 'CANCELLED' },
        });
      }

      const listing = await tx.produceListing.findUnique({
        where: { id: flashSale.listingId },
      });
      if (listing) {
        const newRemaining = listing.remainingKg + restoreQty;
        await tx.produceListing.update({
          where: { id: flashSale.listingId },
          data: {
            activeFlashSaleId: null,
            remainingKg: newRemaining,
            status: newRemaining > 0 ? 'AVAILABLE' : listing.status,
          },
        });
      }
    });

    // 3. Notify buyers with PENDING claims
    const pendingClaims = flashSale.claims.filter((c: any) => c.status === 'PENDING');
    for (const claim of pendingClaims) {
      const buyerMsg = 'The flash sale you claimed was cancelled by the farmer. Your claim has been released.';
      await prisma.notification.create({
        data: {
          userId: claim.buyerId,
          message: `[❌ Flash Sale Cancelled] ${buyerMsg}`,
          type: 'SYSTEM',
        },
      });

      try {
        await SmsOutboundService.sendSms(claim.buyer.phone, 'flash_sale_cancelled_buyer', {});
      } catch (err) {
        console.error(`Failed to notify buyer ${claim.buyer.phone} on cancellation:`, err);
      }
    }
  }

  /**
   * Explicit farmer approval of auto-triggered sales.
   */
  public static async farmerApproveFlashSale(flashSaleId: string, farmerId: string) {
    const flashSale = await (prisma as any).flashSale.findUnique({
      where: { id: flashSaleId },
      include: { listing: { include: { farmer: true } } },
    });

    if (!flashSale) {
      throw createError('Flash sale not found', 'NOT_FOUND', 404);
    }

    if (flashSale.farmerId !== farmerId) {
      throw createError('Unauthorized to approve this flash sale', 'UNAUTHORIZED', 403);
    }

    await (prisma as any).flashSale.update({
      where: { id: flashSaleId },
      data: { farmerApproved: true },
    });

    const msg = 'You have approved the flash sale. Buyers are being notified.';
    await prisma.notification.create({
      data: {
        userId: farmerId,
        message: `[✅ Flash Sale Approved] ${msg}`,
        type: 'SYSTEM',
      },
    });

    try {
      await SmsOutboundService.sendSms(flashSale.listing.farmer.phone, 'flash_sale_approved_farmer', {});
    } catch (err) {
      console.error('Failed to notify farmer on approval:', err);
    }
  }
}
