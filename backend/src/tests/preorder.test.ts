/**
 * Tests for the Pre-Orders & Demand Forecasting module.
 * Covers: Zod schemas, service logic (mocked Prisma), HTTP routes (Prisma mocked in app.smoke.test.ts).
 */

// ── Schema Tests ─────────────────────────────────────────────────────────────
import { CreatePreOrderSchema, PreOrderIdParamSchema, GetDemandSignalsSchema } from '../types/preorder.schema';

describe('CreatePreOrderSchema', () => {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const laterDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const valid = {
    cropType: 'TOMATO',
    quantityKg: 150,
    maxPricePerKg: 5.5,
    harvestWindowStart: futureDate,
    harvestWindowEnd: laterDate,
  };

  it('accepts a valid pre-order payload', () => {
    expect(CreatePreOrderSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an optional preferredRegion', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, preferredRegion: 'Eastern' }).success).toBe(true);
  });

  it('accepts an optional notes field up to 500 chars', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, notes: 'Bulk order for my restaurant.' }).success).toBe(true);
  });

  it('rejects notes longer than 500 characters', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, notes: 'a'.repeat(501) }).success).toBe(false);
  });

  it('rejects a negative quantityKg', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, quantityKg: -10 }).success).toBe(false);
  });

  it('rejects zero quantityKg', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, quantityKg: 0 }).success).toBe(false);
  });

  it('rejects a negative maxPricePerKg', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, maxPricePerKg: -1 }).success).toBe(false);
  });

  it('rejects invalid cropType', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, cropType: 'MANGO' }).success).toBe(false);
  });

  it('rejects invalid ISO date for harvestWindowStart', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, harvestWindowStart: 'not-a-date' }).success).toBe(false);
  });

  it('rejects harvestWindowEnd before harvestWindowStart', () => {
    const result = CreatePreOrderSchema.safeParse({
      ...valid,
      harvestWindowStart: laterDate,
      harvestWindowEnd: futureDate, // earlier than start
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join('.'));
      expect(fields).toContain('harvestWindowEnd');
    }
  });

  it('rejects harvestWindowEnd in the past', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = CreatePreOrderSchema.safeParse({
      ...valid,
      harvestWindowStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      harvestWindowEnd: past,
    });
    expect(result.success).toBe(false);
  });

  it('coerces string quantityKg (form-data)', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, quantityKg: '100' }).success).toBe(true);
  });

  it('coerces string maxPricePerKg (form-data)', () => {
    expect(CreatePreOrderSchema.safeParse({ ...valid, maxPricePerKg: '5.5' }).success).toBe(true);
  });
});

describe('PreOrderIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(PreOrderIdParamSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true);
  });

  it('rejects a non-UUID', () => {
    expect(PreOrderIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects missing id', () => {
    expect(PreOrderIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('GetDemandSignalsSchema', () => {
  it('accepts empty query (all optional)', () => {
    expect(GetDemandSignalsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a valid cropType filter', () => {
    expect(GetDemandSignalsSchema.safeParse({ cropType: 'PEPPER' }).success).toBe(true);
  });

  it('accepts a region filter', () => {
    expect(GetDemandSignalsSchema.safeParse({ region: 'Eastern' }).success).toBe(true);
  });

  it('rejects an invalid cropType', () => {
    expect(GetDemandSignalsSchema.safeParse({ cropType: 'MANGO' }).success).toBe(false);
  });

  it('rejects a region shorter than 2 characters', () => {
    expect(GetDemandSignalsSchema.safeParse({ region: 'X' }).success).toBe(false);
  });
});

// ── Service Unit Tests (mocked Prisma) ────────────────────────────────────────
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    preOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    order: { findUnique: jest.fn() },
    produceListing: { findMany: jest.fn() },
    notification: { create: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

// Mock NotificationService so we don't need Africa's Talking configured
jest.mock('../services/notification.service', () => ({
  NotificationService: {
    createNotification: jest.fn().mockResolvedValue({}),
  },
}));

import prisma from '../prisma/client';
import { PreOrderService } from '../services/preorder.service';
import { NotificationService } from '../services/notification.service';
import { PreOrderStatus } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PreOrderService.confirmDeposit', () => {
  it('upgrades status to OPEN and notifies buyer when reference is found', async () => {
    const mockPreOrder = {
      id: 'po-001',
      buyerId: 'buyer-001',
      cropType: 'TOMATO',
      quantityKg: 100,
      depositAmount: 110,
      status: PreOrderStatus.DEPOSIT_PENDING,
      buyer: { name: 'Ama Serwaa' },
    };

    (prisma.preOrder.findFirst as jest.Mock).mockResolvedValue(mockPreOrder);
    (prisma.preOrder.update as jest.Mock).mockResolvedValue({ ...mockPreOrder, status: PreOrderStatus.OPEN, depositPaid: true });

    await PreOrderService.confirmDeposit('PRE-po-001-1234567890');

    expect(prisma.preOrder.update).toHaveBeenCalledWith({
      where: { id: 'po-001' },
      data: { depositPaid: true, status: PreOrderStatus.OPEN },
    });

    expect(NotificationService.createNotification).toHaveBeenCalledWith(
      'buyer-001',
      'PREORDER_DEPOSIT_CONFIRMED',
      expect.stringContaining('GHS 110.00'),
      true
    );
  });

  it('is idempotent — does nothing if status is already OPEN', async () => {
    const mockPreOrder = {
      id: 'po-001',
      buyerId: 'buyer-001',
      cropType: 'TOMATO',
      quantityKg: 100,
      depositAmount: 110,
      status: PreOrderStatus.OPEN,
      buyer: { name: 'Ama Serwaa' },
    };

    (prisma.preOrder.findFirst as jest.Mock).mockResolvedValue(mockPreOrder);

    await PreOrderService.confirmDeposit('PRE-po-001-already-open');

    expect(prisma.preOrder.update).not.toHaveBeenCalled();
    expect(NotificationService.createNotification).not.toHaveBeenCalled();
  });

  it('logs a warning and returns silently when reference is not found', async () => {
    (prisma.preOrder.findFirst as jest.Mock).mockResolvedValue(null);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(PreOrderService.confirmDeposit('PRE-unknown-ref')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('PreOrderService.cancelPreOrder', () => {
  const basePreOrder = {
    id: 'po-cancel-001',
    buyerId: 'buyer-001',
    cropType: 'PEPPER',
    quantityKg: 50,
    depositAmount: 45,
    depositPaid: false,
    paystackReference: null,
    status: PreOrderStatus.OPEN,
  };

  it('cancels an OPEN pre-order and notifies buyer', async () => {
    (prisma.preOrder.findUnique as jest.Mock).mockResolvedValue(basePreOrder);
    (prisma.preOrder.update as jest.Mock).mockResolvedValue({ ...basePreOrder, status: PreOrderStatus.CANCELLED });

    const result = await PreOrderService.cancelPreOrder('po-cancel-001', 'buyer-001');

    expect(prisma.preOrder.update).toHaveBeenCalledWith({
      where: { id: 'po-cancel-001' },
      data: { status: PreOrderStatus.CANCELLED },
    });
    expect(NotificationService.createNotification).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('throws 404 when pre-order is not found', async () => {
    (prisma.preOrder.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(PreOrderService.cancelPreOrder('not-exist', 'buyer-001')).rejects.toThrow(
      'Pre-order not found'
    );
  });

  it('throws 403 when a different user tries to cancel', async () => {
    (prisma.preOrder.findUnique as jest.Mock).mockResolvedValue(basePreOrder);
    await expect(PreOrderService.cancelPreOrder('po-cancel-001', 'wrong-buyer')).rejects.toThrow(
      'Access forbidden'
    );
  });

  it('throws 400 when pre-order is already FULFILLED', async () => {
    (prisma.preOrder.findUnique as jest.Mock).mockResolvedValue({
      ...basePreOrder,
      status: PreOrderStatus.FULFILLED,
    });
    await expect(PreOrderService.cancelPreOrder('po-cancel-001', 'buyer-001')).rejects.toThrow(
      'Cannot cancel'
    );
  });

  it('throws 400 when pre-order is MATCHED', async () => {
    (prisma.preOrder.findUnique as jest.Mock).mockResolvedValue({
      ...basePreOrder,
      status: PreOrderStatus.MATCHED,
    });
    await expect(PreOrderService.cancelPreOrder('po-cancel-001', 'buyer-001')).rejects.toThrow(
      'Cannot cancel'
    );
  });
});

describe('PreOrderService.matchPreOrderToListing', () => {
  const mockListing = {
    id: 'listing-001',
    cropType: 'TOMATO' as any,
    pricePerKg: 5.0,
    remainingKg: 300,
    harvestDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
    farmerId: 'farmer-001',
    farmer: { region: 'Eastern' },
  };

  it('matches OPEN pre-orders and updates status to MATCHED', async () => {
    const mockMatches = [
      { id: 'po-m-001', buyerId: 'buyer-001', cropType: 'TOMATO', quantityKg: 100, depositAmount: 100, buyer: { id: 'buyer-001', name: 'Ama' } },
    ];
    (prisma.preOrder.findMany as jest.Mock).mockResolvedValue(mockMatches);
    (prisma.preOrder.update as jest.Mock).mockResolvedValue({});

    await PreOrderService.matchPreOrderToListing(mockListing);

    expect(prisma.preOrder.update).toHaveBeenCalledWith({
      where: { id: 'po-m-001' },
      data: { status: PreOrderStatus.MATCHED, matchedListingId: 'listing-001' },
    });
    expect(NotificationService.createNotification).toHaveBeenCalledTimes(2); // buyer + farmer
  });

  it('does nothing when no pre-orders match', async () => {
    (prisma.preOrder.findMany as jest.Mock).mockResolvedValue([]);

    await PreOrderService.matchPreOrderToListing(mockListing);

    expect(prisma.preOrder.update).not.toHaveBeenCalled();
    expect(NotificationService.createNotification).not.toHaveBeenCalled();
  });
});
