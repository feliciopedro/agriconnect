import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { NotificationService } from './notification.service';
import { AuditLogService } from './audit.service';
import { CropType, PreOrderStatus, ListingStatus, Prisma } from '../prisma/generated-client';
import { config } from '../config';

/** Fraction of (quantityKg * maxPricePerKg) charged as deposit. Default: 20% */
const DEPOSIT_PCT = parseFloat(process.env.PREORDER_DEPOSIT_PCT || '0.20');

interface CreatePreOrderData {
  cropType: CropType;
  quantityKg: number;
  maxPricePerKg: number;
  preferredRegion?: string;
  harvestWindowStart: string;
  harvestWindowEnd: string;
  notes?: string;
}

export class PreOrderService {
  /**
   * Creates a pre-order and initializes a Paystack deposit transaction.
   * Returns the pre-order record plus the Paystack authorization URL.
   */
  public static async createPreOrder(buyerId: string, data: CreatePreOrderData) {
    const depositAmount = parseFloat(
      (data.quantityKg * data.maxPricePerKg * DEPOSIT_PCT).toFixed(2)
    );

    // Create pre-order in DEPOSIT_PENDING state
    const preOrder = await prisma.preOrder.create({
      data: {
        buyerId,
        cropType: data.cropType,
        quantityKg: data.quantityKg,
        maxPricePerKg: data.maxPricePerKg,
        preferredRegion: data.preferredRegion,
        harvestWindowStart: new Date(data.harvestWindowStart),
        harvestWindowEnd: new Date(data.harvestWindowEnd),
        notes: data.notes,
        depositAmount,
        status: PreOrderStatus.DEPOSIT_PENDING,
      },
    });

    // Audit Log mutation
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
      },
    });

    // Initialize Paystack deposit
    const { authorizationUrl, reference } = await PreOrderService.initializeDeposit(
      preOrder.id,
      buyerId,
      depositAmount
    );

    // Persist the Paystack reference so the webhook can find this pre-order
    await prisma.preOrder.update({
      where: { id: preOrder.id },
      data: { paystackReference: reference },
    });

    return {
      preOrder: { ...preOrder, paystackReference: reference },
      authorizationUrl,
      reference,
    };
  }

  /**
   * Calls Paystack to initialize a deposit charge.
   * Falls back to mock mode when PAYSTACK_SECRET_KEY contains "mock".
   */
  private static async initializeDeposit(
    preOrderId: string,
    buyerId: string,
    depositAmount: number
  ): Promise<{ authorizationUrl: string; reference: string }> {
    const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer) throw createError('Buyer not found', 'BUYER_NOT_FOUND', 404);

    const reference = `PRE-${preOrderId}-${Date.now()}`;
    const amountPesewas = Math.round(depositAmount * 100);
    const email = `${buyer.phone.replace('+', '')}@agriconnect.gh`;
    const callbackUrl = `${config.FRONTEND_URL}/preorders/${preOrderId}?deposit=complete`;

    const isMock =
      !config.PAYSTACK_SECRET_KEY ||
      config.PAYSTACK_SECRET_KEY.includes('mock') ||
      config.PAYSTACK_SECRET_KEY === 'your_paystack_secret_key';

    if (isMock) {
      console.log(`[DEV] Mock deposit for pre-order ${preOrderId}: GHS ${depositAmount} (ref: ${reference})`);
      return { authorizationUrl: `${callbackUrl}&reference=${reference}`, reference };
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: amountPesewas,
        email,
        reference,
        callback_url: callbackUrl,
        metadata: { preOrderId, buyerId, type: 'PRE_ORDER_DEPOSIT' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw createError(`Paystack deposit init failed: ${text}`, 'DEPOSIT_INIT_ERROR', 500);
    }

    const body = await response.json();
    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference,
    };
  }

  /**
   * Called from the Paystack webhook when a PRE- reference resolves charge.success.
   * Sets depositPaid = true and moves status to OPEN.
   */
  public static async confirmDeposit(paystackReference: string): Promise<void> {
    const preOrder = await prisma.preOrder.findFirst({
      where: { paystackReference },
      include: { buyer: { select: { name: true } } },
    });

    if (!preOrder) {
      console.warn(`[PreOrder] confirmDeposit: no pre-order found for reference ${paystackReference}`);
      return;
    }

    if (preOrder.status !== PreOrderStatus.DEPOSIT_PENDING) {
      // Already confirmed — idempotent, just return
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.preOrder.update({
        where: { id: preOrder.id },
        data: {
          depositPaid: true,
          status: PreOrderStatus.OPEN,
        },
      });

      await AuditLogService.log(
        {
          userId: preOrder.buyerId,
          action: 'DEPOSIT_CONFIRM',
          entityName: 'PreOrder',
          entityId: preOrder.id,
          oldValues: { status: preOrder.status, depositPaid: preOrder.depositPaid },
          newValues: { status: PreOrderStatus.OPEN, depositPaid: true },
        },
        tx
      );
    });

    await NotificationService.createNotification(
      preOrder.buyerId,
      'PREORDER_DEPOSIT_CONFIRMED',
      `✅ Your deposit of GHS ${preOrder.depositAmount.toFixed(2)} for ${preOrder.quantityKg}kg of ${preOrder.cropType} has been confirmed. We'll alert you when a matching farmer listing appears.`,
      true // send SMS
    );
  }

  /**
   * Called fire-and-forget from ListingService.createListing().
   * Finds OPEN pre-orders matching the new listing and notifies buyers.
   */
  public static async matchPreOrderToListing(listing: {
    id: string;
    cropType: CropType;
    pricePerKg: number;
    remainingKg: number;
    harvestDate: Date;
    farmer?: { region?: string | null };
    farmerId: string;
  }): Promise<void> {
    const farmerRegion = listing.farmer?.region ?? null;

    const matchingPreOrders = await prisma.preOrder.findMany({
      where: {
        status: PreOrderStatus.OPEN,
        cropType: listing.cropType,
        maxPricePerKg: { gte: listing.pricePerKg },
        quantityKg: { lte: listing.remainingKg },
        harvestWindowStart: { lte: listing.harvestDate },
        harvestWindowEnd: { gte: listing.harvestDate },
        ...(farmerRegion
          ? {
              OR: [
                { preferredRegion: null },
                { preferredRegion: { equals: farmerRegion, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        buyer: { select: { id: true, name: true } },
      },
    });

    for (const preOrder of matchingPreOrders) {
      await prisma.preOrder.update({
        where: { id: preOrder.id },
        data: {
          status: PreOrderStatus.MATCHED,
          matchedListingId: listing.id,
        },
      });

      // Notify buyer via SMS
      await NotificationService.createNotification(
        preOrder.buyerId,
        'PREORDER_MATCHED',
        `📦 Match found! A farmer listed ${preOrder.quantityKg}kg of ${preOrder.cropType} at GHS ${listing.pricePerKg}/kg${farmerRegion ? ` in ${farmerRegion}` : ''}. Your GHS ${preOrder.depositAmount.toFixed(2)} deposit will be applied when you place your order.`,
        true // send SMS
      );

      // Notify farmer (in-app only)
      await NotificationService.createNotification(
        listing.farmerId,
        'PREORDER_INTERESTED_BUYER',
        `🌱 A pre-order buyer is interested in your ${listing.cropType} listing. Check your listings to view details.`,
        false
      );
    }

    if (matchingPreOrders.length > 0) {
      console.log(
        `[PreOrder] Matched ${matchingPreOrders.length} pre-order(s) to listing ${listing.id}`
      );
    }
  }

  /**
   * Returns a buyer's pre-orders, paginated.
   */
  public static async getMyPreOrders(
    buyerId: string,
    filters: { status?: PreOrderStatus; page?: number; limit?: number }
  ) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.PreOrderWhereInput = {
      buyerId,
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.preOrder.findMany({
        where,
        include: {
          matchedListing: {
            select: {
              id: true,
              batchCode: true,
              cropType: true,
              pricePerKg: true,
              remainingKg: true,
              farmer: { select: { name: true, region: true, district: true } },
            },
          },
          fulfilledOrder: {
            select: { id: true, status: true, totalPrice: true, depositCredit: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.preOrder.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Returns a single pre-order. Accessible by the buyer or by the matched listing's farmer.
   */
  public static async getPreOrderById(preOrderId: string, requestingUserId: string) {
    const preOrder = await prisma.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        buyer: { select: { id: true, name: true } },
        matchedListing: {
          include: {
            farmer: { select: { id: true, name: true, region: true, phone: true } },
          },
        },
        fulfilledOrder: true,
      },
    });

    if (!preOrder) {
      throw createError('Pre-order not found', 'PREORDER_NOT_FOUND', 404);
    }

    const isBuyer = preOrder.buyerId === requestingUserId;
    const isMatchedFarmer = preOrder.matchedListing?.farmerId === requestingUserId;

    if (!isBuyer && !isMatchedFarmer) {
      throw createError(
        'Access forbidden: you are not the buyer or matched farmer of this pre-order',
        'FORBIDDEN_PREORDER_ACCESS',
        403
      );
    }

    return preOrder;
  }

  /**
   * Cancels a pre-order. Allowed only when status is DEPOSIT_PENDING or OPEN.
   * If a deposit was paid, creates an admin notification for manual refund processing.
   */
  public static async cancelPreOrder(preOrderId: string, buyerId: string) {
    const preOrder = await prisma.preOrder.findUnique({ where: { id: preOrderId } });

    if (!preOrder) {
      throw createError('Pre-order not found', 'PREORDER_NOT_FOUND', 404);
    }

    if (preOrder.buyerId !== buyerId) {
      throw createError(
        'Access forbidden: you are not the buyer of this pre-order',
        'FORBIDDEN_PREORDER_CANCEL',
        403
      );
    }

    const cancellableStatuses: PreOrderStatus[] = [
      PreOrderStatus.DEPOSIT_PENDING,
      PreOrderStatus.OPEN,
    ];

    if (!cancellableStatuses.includes(preOrder.status)) {
      throw createError(
        `Cannot cancel a pre-order with status ${preOrder.status}. Only DEPOSIT_PENDING or OPEN pre-orders can be cancelled.`,
        'INVALID_CANCEL_STATE',
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.preOrder.update({
        where: { id: preOrderId },
        data: { status: PreOrderStatus.CANCELLED },
      });

      await AuditLogService.log(
        {
          userId: buyerId,
          action: 'CANCEL',
          entityName: 'PreOrder',
          entityId: preOrderId,
          oldValues: { status: preOrder.status },
          newValues: { status: PreOrderStatus.CANCELLED },
        },
        tx
      );
    });

    // Notify buyer
    await NotificationService.createNotification(
      buyerId,
      'PREORDER_CANCELLED',
      `Your pre-order for ${preOrder.quantityKg}kg of ${preOrder.cropType} has been cancelled.`,
      false
    );

    // If deposit was already paid, alert admin for manual refund
    if (preOrder.depositPaid) {
      // Find any admin user to notify
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (admin) {
        await NotificationService.createNotification(
          admin.id,
          'PREORDER_REFUND_REQUESTED',
          `⚠️ Refund required: Pre-order ${preOrderId.slice(0, 8)} cancelled after deposit paid. Buyer paid GHS ${preOrder.depositAmount.toFixed(2)}. Paystack reference: ${preOrder.paystackReference || 'N/A'}.`,
          false
        );
      }
    }

    return { success: true, preOrderId };
  }

  /**
   * Returns aggregated demand signals grouped by cropType and region.
   * Used by farmers and admins to guide planting decisions.
   */
  public static async getDemandSignals(filters: {
    cropType?: CropType;
    region?: string;
  }) {
    const where: Prisma.PreOrderWhereInput = {
      status: PreOrderStatus.OPEN,
      ...(filters.cropType ? { cropType: filters.cropType } : {}),
      ...(filters.region
        ? {
            OR: [
              { preferredRegion: null },
              { preferredRegion: { contains: filters.region, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const raw = await prisma.preOrder.groupBy({
      by: ['cropType', 'preferredRegion'],
      where,
      _count: { id: true },
      _sum: { quantityKg: true },
      _avg: { maxPricePerKg: true },
      _min: { maxPricePerKg: true, harvestWindowStart: true },
      _max: { maxPricePerKg: true, harvestWindowEnd: true },
      orderBy: { _sum: { quantityKg: 'desc' } },
    });

    const signals = raw.map((row) => ({
      cropType: row.cropType,
      region: row.preferredRegion ?? 'Any region',
      openPreOrders: row._count.id,
      totalKgRequested: row._sum.quantityKg ?? 0,
      avgMaxPricePerKg: parseFloat((row._avg.maxPricePerKg ?? 0).toFixed(2)),
      priceRange: {
        min: row._min.maxPricePerKg ?? 0,
        max: row._max.maxPricePerKg ?? 0,
      },
      harvestWindow: {
        earliest: row._min.harvestWindowStart,
        latest: row._max.harvestWindowEnd,
      },
    }));

    // Hot crops = top 3 by total kg requested
    const hotCrops = signals
      .slice(0, 3)
      .map((s) => s.cropType)
      .filter((c, i, arr) => arr.indexOf(c) === i);

    return { signals, hotCrops, totalOpenPreOrders: raw.reduce((s, r) => s + r._count.id, 0) };
  }

  /**
   * Expires all OPEN pre-orders whose harvestWindowEnd has passed.
   * Notifies affected buyers. Intended for daily admin cron or manual trigger.
   */
  public static async expireStalePreOrders(): Promise<{ expiredCount: number }> {
    const stale = await prisma.preOrder.findMany({
      where: {
        status: PreOrderStatus.OPEN,
        harvestWindowEnd: { lt: new Date() },
      },
      select: { id: true, buyerId: true, cropType: true, quantityKg: true },
    });

    if (stale.length === 0) return { expiredCount: 0 };

    await prisma.$transaction(async (tx) => {
      await tx.preOrder.updateMany({
        where: { id: { in: stale.map((p) => p.id) } },
        data: { status: PreOrderStatus.EXPIRED },
      });

      for (const p of stale) {
        await AuditLogService.log(
          {
            userId: p.buyerId,
            action: 'EXPIRE',
            entityName: 'PreOrder',
            entityId: p.id,
            oldValues: { status: PreOrderStatus.OPEN },
            newValues: { status: PreOrderStatus.EXPIRED },
          },
          tx
        );
      }
    });

    // Notify each buyer
    await Promise.all(
      stale.map((p) =>
        NotificationService.createNotification(
          p.buyerId,
          'PREORDER_EXPIRED',
          `Your pre-order for ${p.quantityKg}kg of ${p.cropType} has expired — no matching listing was found within the harvest window.`,
          false
        )
      )
    );

    return { expiredCount: stale.length };
  }
}
