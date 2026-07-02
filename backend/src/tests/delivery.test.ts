/**
 * Unit tests for the Delivery & Route Optimization module.
 * Covers: OSRM client fallback, TSP solver correctness, and live location updates.
 */

// ── Schema Tests ─────────────────────────────────────────────────────────────
import { UpdateLocationSchema } from '../types/delivery.schema';

describe('UpdateLocationSchema', () => {
  it('accepts valid coordinates', () => {
    const result = UpdateLocationSchema.safeParse({ latitude: 6.0945, longitude: -0.2591 });
    expect(result.success).toBe(true);
  });

  it('coerces string coordinates', () => {
    const result = UpdateLocationSchema.safeParse({ latitude: '6.0945', longitude: '-0.2591' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBe(6.0945);
      expect(result.data.longitude).toBe(-0.2591);
    }
  });

  it('rejects invalid latitude', () => {
    expect(UpdateLocationSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false);
    expect(UpdateLocationSchema.safeParse({ latitude: -91, longitude: 0 }).success).toBe(false);
  });

  it('rejects invalid longitude', () => {
    expect(UpdateLocationSchema.safeParse({ latitude: 0, longitude: 181 }).success).toBe(false);
    expect(UpdateLocationSchema.safeParse({ latitude: 0, longitude: -181 }).success).toBe(false);
  });
});

// ── Service & OSRM Mocking ───────────────────────────────────────────────────
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    deliveryRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn({
      deliveryRequest: { update: jest.fn() },
      traceEvent: { create: jest.fn() },
      order: { update: jest.fn() },
      transportProfile: { update: jest.fn() },
    })),
    $disconnect: jest.fn(),
  },
}));

// Mock NotificationService
jest.mock('../services/notification.service', () => ({
  NotificationService: {
    createNotification: jest.fn().mockResolvedValue({}),
  },
}));

import prisma from '../prisma/client';
import { OSRMClient } from '../utils/osrm';
import { DeliveryService } from '../services/delivery.service';
import { NotificationService } from '../services/notification.service';
import { DeliveryStatus } from '../prisma/generated-client';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OSRMClient Fallback', () => {
  it('automatically falls back to Haversine road calculation in mock/test mode', async () => {
    const coords = [
      { latitude: 6.0945, longitude: -0.2591 }, // Koforidua
      { latitude: 5.9764, longitude: -0.0847 }, // Akropong
    ];

    const matrix = await OSRMClient.getDistanceMatrix(coords);
    expect(matrix.distances.length).toBe(2);
    expect(matrix.durations.length).toBe(2);

    // Diagonal elements should be zero
    expect(matrix.distances[0][0]).toBe(0);
    expect(matrix.distances[1][1]).toBe(0);

    // Off-diagonal segments should be positive
    expect(matrix.distances[0][1]).toBeGreaterThan(0);
    expect(matrix.durations[0][1]).toBeGreaterThan(0);
  });
});

describe('DeliveryService.optimizeGroupedRoute (TSP Solver)', () => {
  it('successfully solves TSP and schedules stop sequence ensuring pickups precede dropoffs', async () => {
    const mockRequests = [
      {
        id: 'req-01',
        pickupLatitude: 6.0945,
        pickupLongitude: -0.2591,
        dropoffLatitude: 5.9764,
        dropoffLongitude: -0.0847,
        scheduledPickup: new Date(),
        order: { listing: { cropType: 'TOMATO', batchCode: 'BAT-TOM-01' } },
      },
      {
        id: 'req-02',
        pickupLatitude: 6.1039,
        pickupLongitude: -0.0150,
        dropoffLatitude: 5.8000,
        dropoffLongitude: -0.1000,
        scheduledPickup: new Date(),
        order: { listing: { cropType: 'PEPPER', batchCode: 'BAT-PEP-01' } },
      },
    ];

    (prisma.deliveryRequest.findMany as jest.Mock).mockResolvedValue(mockRequests);
    (prisma.deliveryRequest.update as jest.Mock).mockResolvedValue({});

    await DeliveryService.optimizeGroupedRoute(['req-01', 'req-02']);

    // Check that routeSequence update was called on requests[0]
    expect(prisma.deliveryRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-01' },
        data: expect.objectContaining({
          routeSequence: expect.any(Array),
        }),
      })
    );

    // Verify precedence constraint (PICKUP before DROPOFF for both reqs)
    const updateCall = (prisma.deliveryRequest.update as jest.Mock).mock.calls.find(
      (call) => call[0].data && call[0].data.routeSequence !== undefined
    );
    expect(updateCall).toBeDefined();

    const sequence: any[] = updateCall[0].data.routeSequence;
    expect(sequence.length).toBe(4);

    const firstPickupIdx = sequence.findIndex((s) => s.requestId === 'req-01' && s.type === 'PICKUP');
    const firstDropoffIdx = sequence.findIndex((s) => s.requestId === 'req-01' && s.type === 'DROPOFF');
    expect(firstPickupIdx).toBeLessThan(firstDropoffIdx);

    const secondPickupIdx = sequence.findIndex((s) => s.requestId === 'req-02' && s.type === 'PICKUP');
    const secondDropoffIdx = sequence.findIndex((s) => s.requestId === 'req-02' && s.type === 'DROPOFF');
    expect(secondPickupIdx).toBeLessThan(secondDropoffIdx);
  });
});

describe('DeliveryService.updateLiveLocation', () => {
  const baseRequest = {
    id: 'req-loc-01',
    orderId: 'order-01',
    transportProviderId: 'trans-01',
    routeGroupId: 'group-01',
    eta: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    status: DeliveryStatus.MATCHED,
    routeSequence: [
      { requestId: 'req-loc-01', type: 'PICKUP', latitude: 6.0945, longitude: -0.2591 },
      { requestId: 'req-loc-01', type: 'DROPOFF', latitude: 5.9764, longitude: -0.0847 },
    ],
  };

  it('updates target coords and pings OSRM for live ETA recalculations', async () => {
    (prisma.deliveryRequest.findUnique as jest.Mock).mockResolvedValue(baseRequest);
    (prisma.deliveryRequest.findMany as jest.Mock).mockResolvedValue([baseRequest]);
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: 'order-01', buyerId: 'buyer-01' });

    const result = await DeliveryService.updateLiveLocation('req-loc-01', 'trans-01', 6.0500, -0.2000);

    expect(prisma.deliveryRequest.updateMany).toHaveBeenCalledWith({
      where: { routeGroupId: 'group-01' },
      data: { currentLatitude: 6.0500, currentLongitude: -0.2000 },
    });

    expect(prisma.deliveryRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-loc-01' },
      data: { eta: expect.any(Date) },
    });

    expect(result.success).toBe(true);
    expect(result.remainingStopsCount).toBe(2);
    expect(result.remainingDistanceKm).toBeGreaterThan(0);
    expect(result.remainingDurationMin).toBeGreaterThan(0);
  });

  it('alerts buyer when ETA shifts by more than 15 minutes', async () => {
    // Current ETA is 1 hour from now. We set a delay in our OSRM mock calculation by adding a massive distance
    const offsetRequest = {
      ...baseRequest,
      eta: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours in the past, triggering a massive shift
    };

    (prisma.deliveryRequest.findUnique as jest.Mock).mockResolvedValue(offsetRequest);
    (prisma.deliveryRequest.findMany as jest.Mock).mockResolvedValue([offsetRequest]);
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: 'order-01', buyerId: 'buyer-01' });

    const result = await DeliveryService.updateLiveLocation('req-loc-01', 'trans-01', 6.0500, -0.2000);

    expect(NotificationService.createNotification).toHaveBeenCalledWith(
      'buyer-01',
      'DELIVERY_ETA_CHANGED',
      expect.stringContaining('Delivery update')
    );
    expect(result.notifiedBuyersCount).toBe(1);
  });

  it('throws 403 when updating coordinates for a request not assigned to the transporter', async () => {
    (prisma.deliveryRequest.findUnique as jest.Mock).mockResolvedValue(baseRequest);

    await expect(
      DeliveryService.updateLiveLocation('req-loc-01', 'wrong-transporter', 6.0, -0.2)
    ).rejects.toThrow('Access forbidden');
  });
});
