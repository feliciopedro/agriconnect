import prisma from '../prisma/client';
import { calculateDistanceKm } from '../utils/distance';
import { LogisticsConfig } from '../config/logistics.config';
import { createError } from '../utils/errors';
import { randomUUID } from 'crypto';
import { NotificationService } from './notification.service';
import { OSRMClient } from '../utils/osrm';
import {
  DeliveryStatus,
  OrderStatus,
  TraceEventType,
  Role
} from '../prisma/generated-client';

interface Stop {
  requestId: string;
  type: 'PICKUP' | 'DROPOFF';
  latitude: number;
  longitude: number;
  cropType: string;
  batchCode: string;
}

export class DeliveryService {
  /**
   * Generates a DeliveryRequest. Asserts buyer coordinates exist and computes pick time windows.
   */
  public static async createDeliveryRequest(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: true,
        buyer: true,
      },
    });

    if (!order) {
      throw createError('Order not found', 'ORDER_NOT_FOUND', 404);
    }

    // Buyer coordinates must be defined for deliveries
    if (order.buyer.latitude === null || order.buyer.longitude === null) {
      throw createError(
        'Please update your delivery location in your profile before confirming an order',
        'BUYER_LOCATION_MISSING',
        400
      );
    }

    const pickupLat = order.listing.latitude;
    const pickupLng = order.listing.longitude;
    const dropoffLat = order.buyer.latitude;
    const dropoffLng = order.buyer.longitude;

    // 1. Calculate suggested pickup: max(now + 12h, harvestDate), limit to expiryDate - 24h
    const now = Date.now();
    const twelveHoursFromNow = now + 12 * 60 * 60 * 1000;
    let pickupTimeMs = twelveHoursFromNow;

    if (order.listing.harvestDate) {
      pickupTimeMs = Math.max(pickupTimeMs, new Date(order.listing.harvestDate).getTime());
    }

    if (order.listing.expiryEstimate) {
      const expiryThreshold = new Date(order.listing.expiryEstimate).getTime() - 24 * 60 * 60 * 1000;
      pickupTimeMs = Math.min(pickupTimeMs, expiryThreshold);
    }

    const scheduledPickup = new Date(pickupTimeMs);
    const costDetails = await this.estimateDeliveryCost(
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      order.quantityKg
    );

    return await prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryRequest.create({
        data: {
          orderId,
          pickupLatitude: pickupLat,
          pickupLongitude: pickupLng,
          dropoffLatitude: dropoffLat,
          dropoffLongitude: dropoffLng,
          scheduledPickup,
          estimatedCost: costDetails.estimatedCost,
          status: DeliveryStatus.REQUESTED,
        },
      });

      // Write TraceEvent: LISTED ("Delivery requested")
      await tx.traceEvent.create({
        data: {
          listingId: order.listingId,
          eventType: TraceEventType.LISTED,
          latitude: pickupLat,
          longitude: pickupLng,
          recordedByUserId: order.buyerId,
          notes: 'Delivery requested',
        },
      });

      return delivery;
    });
  }

  /**
   * Utility helper estimating transport pricing breakdown.
   */
  public static async estimateDeliveryCost(
    pickupLat: number,
    pickupLon: number,
    dropoffLat: number,
    dropoffLon: number,
    weightKg: number
  ) {
    const distanceKm = calculateDistanceKm(pickupLat, pickupLon, dropoffLat, dropoffLon);
    
    const { BASE_FEE, RATE_PER_KM, WEIGHT_SURCHARGE_LIMIT, WEIGHT_SURCHARGE_RATE } = LogisticsConfig;
    
    const baseFee = BASE_FEE;
    const distanceFee = parseFloat((distanceKm * RATE_PER_KM).toFixed(2));
    const weightSurcharge = parseFloat(
      (weightKg > WEIGHT_SURCHARGE_LIMIT
        ? (weightKg - WEIGHT_SURCHARGE_LIMIT) * WEIGHT_SURCHARGE_RATE
        : 0.0
      ).toFixed(2)
    );
    
    const estimatedCost = parseFloat((baseFee + distanceFee + weightSurcharge).toFixed(2));

    return {
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      estimatedCost,
      breakdown: {
        baseFee,
        distanceFee,
        weightSurcharge,
      },
    };
  }

  /**
   * Search for requested delivery requests centered on transport provider radius.
   */
  public static async findAvailableDeliveryRequests(transportProviderId: string) {
    const provider = await prisma.user.findUnique({
      where: { id: transportProviderId },
      include: {
        transportProfile: true,
      },
    });

    if (!provider || !provider.transportProfile) {
      throw createError('Transport provider profile not found', 'PROFILE_NOT_FOUND', 404);
    }

    if (provider.latitude === null || provider.longitude === null) {
      throw createError(
        'Please update your profile location to query available deliveries.',
        'PROVIDER_LOCATION_MISSING',
        400
      );
    }

    const radius = provider.transportProfile.serviceRadiusKm;

    // Use SQL Haversine query to select REQUESTED request IDs within radius
    const matches: { id: string }[] = await prisma.$queryRawUnsafe(
      `SELECT id
       FROM "DeliveryRequest"
       WHERE status = 'REQUESTED'
         AND (6371 * acos(cos(radians($1)) * cos(radians("pickupLatitude")) * cos(radians("pickupLongitude") - radians($2)) + sin(radians($1)) * sin(radians("pickupLatitude")))) <= $3`,
      provider.latitude,
      provider.longitude,
      radius
    );

    if (matches.length === 0) {
      return { ungrouped: [], groupedRoutes: [] };
    }

    const ids = matches.map((m) => m.id);

    const requests = await prisma.deliveryRequest.findMany({
      where: { id: { in: ids } },
      include: {
        order: {
          include: {
            listing: {
              include: {
                farmer: {
                  select: { name: true },
                },
              },
            },
            buyer: {
              select: { name: true },
            },
          },
        },
      },
    });

    const grouped: { [key: string]: typeof requests } = {};
    const ungrouped: typeof requests = [];

    for (const req of requests) {
      if (req.routeGroupId) {
        if (!grouped[req.routeGroupId]) {
          grouped[req.routeGroupId] = [];
        }
        grouped[req.routeGroupId].push(req);
      } else {
        ungrouped.push(req);
      }
    }

    const groupedRoutes = Object.entries(grouped).map(([groupId, members]) => {
      // Find the requests containing routeSequence log
      const leadRequest = members.find((m) => m.routeSequence !== null) || members[0];
      return {
        routeGroupId: groupId,
        routeSequence: leadRequest.routeSequence,
        members,
      };
    });

    return {
      ungrouped,
      groupedRoutes,
    };
  }

  /**
   * Group nearby requests where pickups are within 5km on the same calendar day.
   */
  public static async groupNearbyRequests() {
    const requests = await prisma.deliveryRequest.findMany({
      where: {
        status: DeliveryStatus.REQUESTED,
        routeGroupId: null,
      },
      include: {
        order: {
          include: {
            listing: true,
          },
        },
      },
    });

    const groups: typeof requests[] = [];
    const visited = new Set<string>();

    // Greedy grouping algorithm
    for (let i = 0; i < requests.length; i++) {
      const r1 = requests[i];
      if (visited.has(r1.id)) continue;

      const currentGroup = [r1];
      const r1Date = r1.scheduledPickup ? new Date(r1.scheduledPickup).toDateString() : null;

      for (let j = i + 1; j < requests.length; j++) {
        const r2 = requests[j];
        if (visited.has(r2.id)) continue;

        const r2Date = r2.scheduledPickup ? new Date(r2.scheduledPickup).toDateString() : null;

        if (r1Date && r2Date && r1Date === r2Date) {
          const distance = calculateDistanceKm(
            r1.pickupLatitude,
            r1.pickupLongitude,
            r2.pickupLatitude,
            r2.pickupLongitude
          );
          
          if (distance <= 5.0) {
            currentGroup.push(r2);
          }
        }
      }

      if (currentGroup.length >= 2) {
        groups.push(currentGroup);
        currentGroup.forEach((r) => visited.add(r.id));
      }
    }

    let groupsCreated = 0;
    let requestsGrouped = 0;

    for (const group of groups) {
      const groupId = randomUUID();
      const ids = group.map((r) => r.id);

      await prisma.deliveryRequest.updateMany({
        where: { id: { in: ids } },
        data: { routeGroupId: groupId },
      });

      // Compute route optimization sequence
      await this.optimizeGroupedRoute(ids);

      groupsCreated++;
      requestsGrouped += ids.length;
    }

    const ungroupedRemaining = requests.length - requestsGrouped;

    return {
      groupsCreated,
      requestsGrouped,
      ungroupedRemaining,
    };
  }

  /**
   * Optimize travel stops using a precedence-constrained TSP solver via OSRM.
   * Finds the absolute shortest driving path where pickups precede dropoffs.
   * Dynamically calculates ETAs for all stops.
   */
  public static async optimizeGroupedRoute(deliveryRequestIds: string[]): Promise<void> {
    const requests = await prisma.deliveryRequest.findMany({
      where: { id: { in: deliveryRequestIds } },
      include: {
        order: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (requests.length === 0) return;

    const stops: Stop[] = [];
    for (const req of requests) {
      stops.push({
        requestId: req.id,
        type: 'PICKUP',
        latitude: req.pickupLatitude,
        longitude: req.pickupLongitude,
        cropType: req.order.listing.cropType,
        batchCode: req.order.listing.batchCode,
      });
      stops.push({
        requestId: req.id,
        type: 'DROPOFF',
        latitude: req.dropoffLatitude,
        longitude: req.dropoffLongitude,
        cropType: req.order.listing.cropType,
        batchCode: req.order.listing.batchCode,
      });
    }

    // Centroid starting point for the solver
    const pickups = stops.filter((s) => s.type === 'PICKUP');
    const startLat = pickups.reduce((sum, p) => sum + p.latitude, 0) / pickups.length;
    const startLng = pickups.reduce((sum, p) => sum + p.longitude, 0) / pickups.length;

    // Fetch distance/duration matrix for start point (idx 0) and all stops (idx 1..2N)
    const coords = [
      { latitude: startLat, longitude: startLng },
      ...stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    ];

    const matrix = await OSRMClient.getDistanceMatrix(coords);
    const N = requests.length;

    let bestPath: number[] = [];
    let minCost = Infinity;

    // Precedence-constrained TSP backtracking search
    function solveTsp(
      currentPath: number[],
      currentCost: number,
      visitedPickups: Set<string>
    ) {
      if (currentPath.length === 2 * N) {
        if (currentCost < minCost) {
          minCost = currentCost;
          bestPath = [...currentPath];
        }
        return;
      }

      for (let i = 0; i < 2 * N; i++) {
        if (currentPath.includes(i)) continue;

        const stop = stops[i];
        if (stop.type === 'DROPOFF' && !visitedPickups.has(stop.requestId)) continue;

        const fromMatrixIdx = currentPath.length === 0 ? 0 : currentPath[currentPath.length - 1] + 1;
        const toMatrixIdx = i + 1;
        const transitionCost = matrix.durations[fromMatrixIdx][toMatrixIdx];

        if (currentCost + transitionCost >= minCost) continue; // Pruning

        const nextVisited = new Set(visitedPickups);
        if (stop.type === 'PICKUP') {
          nextVisited.add(stop.requestId);
        }

        currentPath.push(i);
        solveTsp(currentPath, currentCost + transitionCost, nextVisited);
        currentPath.pop();
      }
    }

    solveTsp([], 0, new Set<string>());

    // Fallback in case of solver issues
    const orderedStops = bestPath.length > 0
      ? bestPath.map((idx) => stops[idx])
      : stops;

    // Compute segments and stop ETAs
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;

    // Use scheduledPickup of the first request as start, fallback to now
    const baseDate = requests[0].scheduledPickup || new Date();
    let currentTimeMs = baseDate.getTime();

    const stopEtasMap = new Map<string, { pickupEta?: Date; dropoffEta?: Date }>();

    for (let i = 0; i < orderedStops.length; i++) {
      const stop = orderedStops[i];
      const fromMatrixIdx = i === 0 ? 0 : (bestPath[i - 1] !== undefined ? bestPath[i - 1] + 1 : 0);
      const toMatrixIdx = bestPath[i] !== undefined ? bestPath[i] + 1 : i + 1;

      const segmentDist = matrix.distances[fromMatrixIdx][toMatrixIdx];
      const segmentDur = matrix.durations[fromMatrixIdx][toMatrixIdx];

      totalDistanceMeters += segmentDist;
      totalDurationSeconds += segmentDur;

      currentTimeMs += segmentDur * 1000;
      const arrivalTime = new Date(currentTimeMs);

      if (!stopEtasMap.has(stop.requestId)) {
        stopEtasMap.set(stop.requestId, {});
      }
      const item = stopEtasMap.get(stop.requestId)!;
      if (stop.type === 'PICKUP') {
        item.pickupEta = arrivalTime;
      } else {
        item.dropoffEta = arrivalTime;
      }

      // 10 minutes service delay per stop (loading/unloading)
      currentTimeMs += 600 * 1000;
      totalDurationSeconds += 600;
    }

    // Save routing metrics and ETAs on the requests
    for (const req of requests) {
      const etas = stopEtasMap.get(req.id);
      const dropoffEta = etas?.dropoffEta || null;

      await prisma.deliveryRequest.update({
        where: { id: req.id },
        data: {
          eta: dropoffEta,
          routeDistanceKm: parseFloat((totalDistanceMeters / 1000).toFixed(2)),
          routeDurationMin: parseFloat((totalDurationSeconds / 60).toFixed(2)),
        },
      });
    }

    // Save optimized routeSequence on first request in the group
    await prisma.deliveryRequest.update({
      where: { id: requests[0].id },
      data: {
        routeSequence: orderedStops as any,
      },
    });
  }

  /**
   * Transporters update their live location, triggering real-time ETA updates.
   */
  public static async updateLiveLocation(
    deliveryRequestId: string,
    transportProviderId: string,
    latitude: number,
    longitude: number
  ) {
    const req = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
      include: {
        order: { select: { buyerId: true } },
      },
    });

    if (!req) {
      throw createError('Delivery request not found', 'DELIVERY_NOT_FOUND', 404);
    }

    if (req.transportProviderId !== transportProviderId) {
      throw createError(
        'Access forbidden: only the assigned transport provider can update location',
        'FORBIDDEN_LOCATION_UPDATE',
        403
      );
    }

    const routeGroupId = req.routeGroupId;
    const whereClause = routeGroupId ? { routeGroupId } : { id: deliveryRequestId };

    // Update transporter coordinates on all matching requests
    await prisma.deliveryRequest.updateMany({
      where: whereClause,
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
      },
    });

    const groupRequests = await prisma.deliveryRequest.findMany({
      where: whereClause,
    });

    const leadRequest = groupRequests.find((r) => r.routeSequence !== null);
    if (!leadRequest || !leadRequest.routeSequence) {
      return { success: true, updatedCount: groupRequests.length };
    }

    const fullSequence = leadRequest.routeSequence as any as Stop[];

    // Remaining incomplete stops
    const incompleteStops = fullSequence.filter((stop) => {
      const matchReq = groupRequests.find((r) => r.id === stop.requestId);
      if (!matchReq) return false;
      if (stop.type === 'PICKUP') {
        return matchReq.status !== DeliveryStatus.PICKED_UP && matchReq.status !== DeliveryStatus.DELIVERED;
      } else {
        return matchReq.status !== DeliveryStatus.DELIVERED;
      }
    });

    if (incompleteStops.length === 0) {
      return { success: true, remainingStops: 0 };
    }

    // Call OSRM starting from the transporter's live position
    const coords = [
      { latitude, longitude },
      ...incompleteStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    ];

    const matrix = await OSRMClient.getDistanceMatrix(coords);

    let currentTimeMs = Date.now();
    let totalRemDistanceMeters = 0;
    let totalRemDurationSeconds = 0;

    const updatedEtas = new Map<string, Date>();

    for (let i = 0; i < incompleteStops.length; i++) {
      const stop = incompleteStops[i];
      const fromMatrixIdx = i === 0 ? 0 : i;
      const toMatrixIdx = i + 1;

      const segmentDist = matrix.distances[fromMatrixIdx][toMatrixIdx];
      const segmentDur = matrix.durations[fromMatrixIdx][toMatrixIdx];

      totalRemDistanceMeters += segmentDist;
      totalRemDurationSeconds += segmentDur;

      currentTimeMs += segmentDur * 1000;
      const arrivalTime = new Date(currentTimeMs);

      if (stop.type === 'DROPOFF') {
        updatedEtas.set(stop.requestId, arrivalTime);
      }

      currentTimeMs += 600 * 1000; // 10 min stop duration
      totalRemDurationSeconds += 600;
    }

    const notifiedBuyers: string[] = [];

    for (const [reqId, newEta] of updatedEtas.entries()) {
      const targetReq = groupRequests.find((r) => r.id === reqId);
      if (!targetReq) continue;

      const oldEta = targetReq.eta;

      await prisma.deliveryRequest.update({
        where: { id: reqId },
        data: { eta: newEta },
      });

      if (oldEta) {
        const diffMin = Math.abs(newEta.getTime() - oldEta.getTime()) / (60 * 1000);
        if (diffMin > 15) {
          const buyerOrder = await prisma.order.findUnique({ where: { id: targetReq.orderId } });
          if (buyerOrder) {
            await NotificationService.createNotification(
              buyerOrder.buyerId,
              'DELIVERY_ETA_CHANGED',
              `⚠️ Delivery update: The estimated arrival time for your order has changed to ${newEta.toLocaleTimeString()}.`
            );
            notifiedBuyers.push(reqId);
          }
        }
      }
    }

    return {
      success: true,
      currentCoordinates: { latitude, longitude },
      remainingStopsCount: incompleteStops.length,
      remainingDistanceKm: parseFloat((totalRemDistanceMeters / 1000).toFixed(2)),
      remainingDurationMin: parseFloat((totalRemDurationSeconds / 60).toFixed(2)),
      notifiedBuyersCount: notifiedBuyers.length,
    };
  }

  /**
   * Transporter accepts delivery route. Sets transport status MATCHED.
   */
  public static async acceptDeliveryRequest(deliveryRequestId: string, transportProviderId: string) {
    const req = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
    });

    if (!req) {
      throw createError('Delivery request not found', 'DELIVERY_NOT_FOUND', 404);
    }

    // Find all requests in route group if batched
    let requestsToUpdate = [deliveryRequestId];
    if (req.routeGroupId) {
      const groupReqs = await prisma.deliveryRequest.findMany({
        where: { routeGroupId: req.routeGroupId },
      });
      requestsToUpdate = groupReqs.map((r) => r.id);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Update all requests in path to MATCHED
      await tx.deliveryRequest.updateMany({
        where: { id: { in: requestsToUpdate } },
        data: {
          transportProviderId,
          status: DeliveryStatus.MATCHED,
        },
      });

      // 2. Set transporter profile isAvailable = false
      await tx.transportProfile.update({
        where: { userId: transportProviderId },
        data: { isAvailable: false },
      });

      // 3. Dispatch notifications for all orders in path
      const activeRequests = await tx.deliveryRequest.findMany({
        where: { id: { in: requestsToUpdate } },
        include: {
          order: {
            include: {
              listing: true,
            },
          },
        },
      });

      for (const r of activeRequests) {
        // Farmer Alert
        await NotificationService.createNotification(
          r.order.listing.farmerId,
          'DELIVERY_MATCHED',
          `A transport provider has accepted delivery of your ${r.order.listing.cropType}`,
          false,
          tx
        );
        
        // Buyer Alert
        await NotificationService.createNotification(
          r.order.buyerId,
          'DELIVERY_MATCHED',
          'Your order is matched with a transport provider',
          false,
          tx
        );
      }

      return { success: true, requestsUpdated: requestsToUpdate.length };
    });
  }

  /**
   * Update status transitions (MATCHED -> PICKED_UP -> DELIVERED).
   * Generates audit TraceEvents, updates linked orders, and handles review prompts.
   */
  public static async updateDeliveryStatus(
    deliveryRequestId: string,
    newStatus: DeliveryStatus,
    actorUserId: string,
    location?: { latitude: number; longitude: number }
  ) {
    const req = await prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
      include: {
        order: {
          include: {
            listing: {
              include: {
                farmer: { select: { name: true } },
              },
            },
            buyer: { select: { name: true } },
          },
        },
      },
    });

    if (!req) {
      throw createError('Delivery request not found', 'DELIVERY_NOT_FOUND', 404);
    }

    // Assert actor is the assigned transporter
    if (req.transportProviderId !== actorUserId) {
      throw createError(
        'Access forbidden: only the assigned transport provider can update status',
        'FORBIDDEN_STATUS_UPDATE',
        403
      );
    }

    const currentStatus = req.status;

    // Transition constraints: MATCHED -> PICKED_UP -> DELIVERED
    if (newStatus === DeliveryStatus.PICKED_UP) {
      if (currentStatus !== DeliveryStatus.MATCHED) {
        throw createError(
          'Invalid transition. Delivery must be MATCHED before it can be PICKED_UP.',
          'INVALID_TRANSITION',
          400
        );
      }
    } else if (newStatus === DeliveryStatus.DELIVERED) {
      if (currentStatus !== DeliveryStatus.PICKED_UP) {
        throw createError(
          'Invalid transition. Delivery must be PICKED_UP before it can be DELIVERED.',
          'INVALID_TRANSITION',
          400
        );
      }
    } else {
      throw createError(`Invalid target status transition: ${newStatus}`, 'INVALID_TRANSITION', 400);
    }

    return await prisma.$transaction(async (tx) => {
      let updatedRequest;

      if (newStatus === DeliveryStatus.PICKED_UP) {
        const lat = location?.latitude ?? req.pickupLatitude;
        const lng = location?.longitude ?? req.pickupLongitude;

        // Update delivery request status & telemetry coordinates
        updatedRequest = await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: {
            status: newStatus,
            currentLatitude: lat,
            currentLongitude: lng,
          },
        });

        // Log TraceEvent PICKED_UP
        await tx.traceEvent.create({
          data: {
            listingId: req.order.listingId,
            eventType: TraceEventType.PICKED_UP,
            latitude: lat,
            longitude: lng,
            recordedByUserId: actorUserId,
            notes: 'Cargo loaded and in transit.',
          },
        });

        // Set linked Order in transit
        await tx.order.update({
          where: { id: req.orderId },
          data: { status: OrderStatus.IN_TRANSIT },
        });

        // Notify Buyer
        await NotificationService.createNotification(
          req.order.buyerId,
          'DELIVERY_PICKED_UP',
          'Your order has been picked up and is on the way',
          false,
          tx
        );
      }

      if (newStatus === DeliveryStatus.DELIVERED) {
        // Update delivery request status & final telemetry coordinates
        updatedRequest = await tx.deliveryRequest.update({
          where: { id: deliveryRequestId },
          data: {
            status: newStatus,
            currentLatitude: req.dropoffLatitude,
            currentLongitude: req.dropoffLongitude,
          },
        });

        // Log TraceEvent DELIVERED
        await tx.traceEvent.create({
          data: {
            listingId: req.order.listingId,
            eventType: TraceEventType.DELIVERED,
            latitude: req.dropoffLatitude,
            longitude: req.dropoffLongitude,
            recordedByUserId: actorUserId,
            notes: 'Package delivered at buyer destination.',
          },
        });

        // Set linked Order delivered
        await tx.order.update({
          where: { id: req.orderId },
          data: { status: OrderStatus.DELIVERED },
        });

        // Reset transporter availability to true
        await tx.transportProfile.update({
          where: { userId: actorUserId },
          data: { isAvailable: true },
        });

        // High priority notifications (SMS log & alerts)
        console.log(`[SMS - DELIVERED] Delivery completed for order ${req.orderId.slice(0, 8)}`);
        
        await NotificationService.createNotification(
          req.order.buyerId,
          'DELIVERY_COMPLETED',
          'Delivery completed',
          true, // high-priority, send SMS!
          tx
        );

        await NotificationService.createNotification(
          req.order.listing.farmerId,
          'DELIVERY_COMPLETED',
          'Delivery completed',
          true, // high-priority, send SMS!
          tx
        );

        // Trigger Review Prompts
        await NotificationService.createNotification(
          req.order.buyerId,
          'REVIEW_PROMPT',
          `Please review your delivery of ${req.order.listing.cropType} from ${req.order.listing.farmer.name}`,
          false,
          tx
        );

        await NotificationService.createNotification(
          req.order.listing.farmerId,
          'REVIEW_PROMPT',
          `Please review buyer ${req.order.buyer.name} for order ${req.orderId.slice(0, 8)}`,
          false,
          tx
        );
      }

      return updatedRequest;
    });
  }
}
