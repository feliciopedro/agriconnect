import prisma from '../prisma/client';
import { CropType, PreOrderStatus } from '../prisma/generated-client';
import { AuditLogService } from './audit.service';

export class DemandSignalService {
  /**
   * Creates a demand signal (a PreOrder record that defaults to OPEN status
   * so it is immediately visible to farmers in the area).
   */
  public static async createDemandSignal(buyerId: string, data: {
    cropType: CropType;
    quantityKg: number;
    harvestWindowEnd: Date;
    maxPricePerKg?: number;
  }) {
    const user = await prisma.user.findUnique({ where: { id: buyerId } });
    const preferredRegion = user?.region || null;

    const maxPricePerKg = data.maxPricePerKg || 0;
    const harvestWindowStart = new Date();

    const DEPOSIT_PCT = parseFloat(process.env.PREORDER_DEPOSIT_PCT || '0.20');
    const depositAmount = parseFloat((data.quantityKg * maxPricePerKg * DEPOSIT_PCT).toFixed(2));

    const preOrder = await prisma.preOrder.create({
      data: {
        buyerId,
        cropType: data.cropType,
        quantityKg: data.quantityKg,
        maxPricePerKg,
        preferredRegion,
        harvestWindowStart,
        harvestWindowEnd: data.harvestWindowEnd,
        depositAmount,
        depositPaid: true, // Bypass deposit payment check since it's a direct demand signal from USSD
        status: PreOrderStatus.OPEN,
      }
    });

    await AuditLogService.log({
      userId: buyerId,
      action: 'CREATE',
      entityName: 'PreOrder',
      entityId: preOrder.id,
      newValues: {
        cropType: preOrder.cropType,
        quantityKg: preOrder.quantityKg,
        maxPricePerKg: preOrder.maxPricePerKg,
        status: preOrder.status,
      }
    });

    return preOrder;
  }

  /**
   * Matches demand signals (open pre-orders) to a farmer listing and dispatches demand_signal_matched SMS alerts.
   */
  public static async matchDemandSignalToListing(listing: {
    id: string;
    cropType: CropType;
    pricePerKg: number;
    remainingKg: number;
    harvestDate: Date;
    farmer?: { region?: string | null };
    farmerId: string;
  }) {
    const { PreOrderService } = require('./preorder.service');
    const { SmsOutboundService } = require('./ussd/smsOutbound.service');

    // Perform DB matching
    await PreOrderService.matchPreOrderToListing(listing);

    // Retrieve matched preorders for this listing
    const matched = await prisma.preOrder.findMany({
      where: { matchedListingId: listing.id, status: 'MATCHED' },
      include: { buyer: true }
    });

    // Send SMS alerts
    for (const po of matched) {
      try {
        await SmsOutboundService.sendSms(po.buyer.phone, 'demand_signal_matched', {
          crop: listing.cropType
        });
      } catch (err) {
        console.error('Failed to send demand_signal_matched SMS:', err);
      }
    }
  }
}
