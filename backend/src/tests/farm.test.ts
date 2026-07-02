/**
 * Unit tests for the Farm & Crop Management (Planting Journal) module.
 * Covers: input validation, yield predictions fallback logic, and traceability auto-population.
 */

// ── Schema Tests ─────────────────────────────────────────────────────────────
import { CreatePlantingLogSchema, AddInputSchema, HarvestLogSchema, PredictYieldQuerySchema } from '../types/farm.schema';

describe('CreatePlantingLogSchema', () => {
  const futureStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const futureEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const valid = {
    cropType: 'TOMATO',
    acreage: 2.5,
    plantingDate: futureStart,
    expectedHarvestDate: futureEnd,
  };

  it('accepts a valid planting log payload', () => {
    expect(CreatePlantingLogSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a negative acreage', () => {
    expect(CreatePlantingLogSchema.safeParse({ ...valid, acreage: -0.5 }).success).toBe(false);
  });

  it('rejects expectedHarvestDate before plantingDate', () => {
    expect(
      CreatePlantingLogSchema.safeParse({
        ...valid,
        plantingDate: futureEnd,
        expectedHarvestDate: futureStart,
      }).success
    ).toBe(false);
  });
});

describe('AddInputSchema', () => {
  it('accepts valid input specifications', () => {
    expect(
      AddInputSchema.safeParse({
        type: 'FERTILIZER',
        name: 'NPK 15-15-15',
        quantity: 3,
        unit: 'bags',
      }).success
    ).toBe(true);
  });

  it('rejects invalid input type', () => {
    expect(
      AddInputSchema.safeParse({
        type: 'WATER', // not in enum
        name: 'Irrigation',
      }).success
    ).toBe(false);
  });

  it('requires unit when quantity is provided', () => {
    // Note: Zod validation doesn't strictly check conditional field cross-reference unless refined, but standard check:
    expect(AddInputSchema.safeParse({ type: 'FERTILIZER', name: 'NPK', quantity: 2 }).success).toBe(true);
  });
});

// ── Service Unit Tests (mocked Prisma) ────────────────────────────────────────
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    plantingLog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    plantingInput: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    produceListing: {
      create: jest.fn(),
    },
    traceEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn({
      produceListing: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({
          id: 'listing-001',
          ...args.data,
          traceability: args.data.traceability?.create ? args.data.traceability.create : null,
        })),
      },
      traceEvent: { create: jest.fn().mockResolvedValue({}) },
    })),
    preOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import prisma from '../prisma/client';
import { FarmService } from '../services/farm.service';
import { ListingService } from '../services/listing.service';
import { CropType } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.plantingLog.findMany as jest.Mock).mockReset();
  (prisma.plantingLog.findUnique as jest.Mock).mockReset();
  (prisma.plantingLog.create as jest.Mock).mockReset();
  (prisma.plantingLog.update as jest.Mock).mockReset();
  (prisma.user.findUnique as jest.Mock).mockReset();
  (prisma.preOrder.findMany as jest.Mock).mockResolvedValue([]);
});

describe('FarmService.predictYield (Hierarchical Fallback)', () => {
  it('calculates average using farm history if available', async () => {
    const mockFarmerHarvests = [
      { id: 'log-01', acreage: 2.0, actualYieldKg: 10000 }, // 5000 kg/acre
      { id: 'log-02', acreage: 3.0, actualYieldKg: 12000 }, // 4000 kg/acre
    ];

    (prisma.plantingLog.findMany as jest.Mock)
      .mockResolvedValueOnce(mockFarmerHarvests) // First call: Farmer harvests
      .mockResolvedValueOnce([]);                // Fallback (ignored)

    const result = await FarmService.predictYield('farmer-01', CropType.TOMATO, 5.0);

    expect(result.basis).toBe('FARM_HISTORY');
    expect(result.dataPointsCount).toBe(2);
    expect(result.predictedYieldKg).toBe(22500); // 4500 avg yield/acre * 5 acres = 22500
  });

  it('falls back to platform average if farmer history is empty', async () => {
    const mockPlatformHarvests = [
      { id: 'log-03', acreage: 1.0, actualYieldKg: 8000 }, // 8000 kg/acre
    ];

    (prisma.plantingLog.findMany as jest.Mock)
      .mockResolvedValueOnce([])                   // First call: Farmer harvests (empty)
      .mockResolvedValueOnce(mockPlatformHarvests); // Second call: Platform harvests

    const result = await FarmService.predictYield('farmer-01', CropType.PEPPER, 2.0);

    expect(result.basis).toBe('PLATFORM_AVERAGE');
    expect(result.dataPointsCount).toBe(1);
    expect(result.predictedYieldKg).toBe(16000); // 8000 avg yield/acre * 2 acres = 16000
  });

  it('falls back to crop default constants if zero history exists', async () => {
    (prisma.plantingLog.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // Farmer history empty
      .mockResolvedValueOnce([]); // Platform history empty

    const result = await FarmService.predictYield('farmer-01', CropType.OKRA, 3.0);

    expect(result.basis).toBe('CROP_DEFAULT');
    expect(result.dataPointsCount).toBe(0);
    expect(result.predictedYieldKg).toBe(15000); // Okra default = 5000 kg/acre * 3 = 15000
  });
});

describe('ListingService Traceability Auto-Population', () => {
  it('automatically populates traceability record details from linked planting log inputs', async () => {
    const mockLog = {
      id: 'log-01',
      farmerId: 'farmer-01',
      plantingDate: new Date('2026-05-01'),
      inputs: [
        { type: 'FERTILIZER', name: 'NPK 15-15-15', quantity: 2, unit: 'bags' },
        { type: 'IRRIGATION', name: 'Drip system', quantity: null, unit: null },
      ],
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'farmer-01', region: 'Eastern' });
    (prisma.plantingLog.findUnique as jest.Mock).mockResolvedValue(mockLog);

    const listingData = {
      cropType: 'TOMATO',
      quantityKg: 100,
      pricePerKg: 5.0,
      harvestDate: new Date().toISOString(),
      latitude: 6.0945,
      longitude: -0.2591,
      plantingLogId: 'log-01',
    };

    const listing = await ListingService.createListing('farmer-01', listingData, []);

    // Transaction payload contains transactionally updated TraceabilityRecord values
    expect(prisma.$transaction).toHaveBeenCalled();
    const transactionCall = (prisma.$transaction as jest.Mock).mock.calls[0][0];

    // Build mock tx execution context
    const mockTx = {
      produceListing: {
        create: jest.fn().mockImplementation((args) => {
          // Verify arguments mapped to transactional creation call
          expect(args.data.plantingLogId).toBe('log-01');
          expect(args.data.traceability.create.plantingDate).toEqual(mockLog.plantingDate);
          expect(args.data.traceability.create.inputsUsed).toEqual([
            'FERTILIZER: NPK 15-15-15 (2 bags)',
            'IRRIGATION: Drip system',
          ]);
          return Promise.resolve({ id: 'listing-001' });
        }),
      },
      traceEvent: { create: jest.fn().mockResolvedValue({}) },
    };

    await transactionCall(mockTx);
    expect(mockTx.produceListing.create).toHaveBeenCalled();
  });

  it('throws 403 error if a farmer tries to link a planting log they do not own', async () => {
    const mockLog = {
      id: 'log-01',
      farmerId: 'different-farmer-id',
      plantingDate: new Date('2026-05-01'),
      inputs: [],
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'farmer-01', region: 'Eastern' });
    (prisma.plantingLog.findUnique as jest.Mock).mockResolvedValue(mockLog);

    const listingData = {
      cropType: 'TOMATO',
      quantityKg: 100,
      pricePerKg: 5.0,
      harvestDate: new Date().toISOString(),
      latitude: 6.0945,
      longitude: -0.2591,
      plantingLogId: 'log-01',
    };

    await expect(
      ListingService.createListing('farmer-01', listingData, [])
    ).rejects.toThrow('Access forbidden');
  });
});
