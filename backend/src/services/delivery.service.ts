import prisma from '../prisma/client';
import { calculateDistanceKm } from '../utils/distance';
import { LogisticsConfig } from '../config/logistics.config';
import { createError } from '../utils/errors';
import { randomUUID } from 'crypto';
import { NotificationService } from './notification.service';
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
   * Optimize travel stops utilizing nearest-neighbor heuristic (Precedence constraint checked).
   * Comment: "This is a nearest-neighbor heuristic suitable for groups of 3-8 stops. Replace with Google OR-Tools VRP solver for production scale."
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

    // Centroid starting point for the heuristic (approximate centroid of all pickups)
    const pickups = stops.filter((s) => s.type === 'PICKUP');
    const startLat = pickups.reduce((sum, p) => sum + p.latitude, 0) / pickups.length;
    const startLng = pickups.reduce((sum, p) => sum + p.longitude, 0) / pickups.length;

    let currentLat = startLat;
    let currentLng = startLng;
    
    const visitedStops: Stop[] = [];
    const unvisited = [...stops];
    const visitedPickups = new Set<string>(); // Tracks requests whose pickups are complete

    while (unvisited.length > 0) {
      // Filter candidates applying precedence: DROPOFF only valid if its PICKUP was visited
      const candidates = unvisited.filter((s) => {
        if (s.type === 'PICKUP') return true;
        return visitedPickups.has(s.requestId);
      });

      if (candidates.length === 0) break;

      // Select closest candidate
      let closest = candidates[0];
      let minDistance = Infinity;

      for (const cand of candidates) {
        const dist = calculateDistanceKm(currentLat, currentLng, cand.latitude, cand.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          closest = cand;
        }
      }

      visitedStops.push(closest);
      if (closest.type === 'PICKUP') {
        visitedPickups.add(closest.requestId);
      }

      currentLat = closest.latitude;
      currentLng = closest.longitude;

      // Remove from unvisited list
      const idx = unvisited.findIndex(
        (s) => s.requestId === closest.requestId && s.type === closest.type
      );
      if (idx !== -1) {
        unvisited.splice(idx, 1);
      }
    }

    // Save routing sequence JSON on first request in the group
    await prisma.deliveryRequest.update({
      where: { id: requests[0].id },
      data: {
        routeSequence: visitedStops as any,
      },
    });
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
      // Update delivery request status
      const updatedRequest = await tx.deliveryRequest.update({
        where: { id: deliveryRequestId },
        data: { status: newStatus },
      });

      if (newStatus === DeliveryStatus.PICKED_UP) {
        const lat = location?.latitude ?? req.pickupLatitude;
        const lng = location?.longitude ?? req.pickupLongitude;

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
