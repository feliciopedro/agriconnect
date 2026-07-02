import { Request, Response } from 'express';
import { DeliveryService } from '../services/delivery.service';
import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { DeliveryStatus } from '../prisma/generated-client';

export class DeliveryController {
  /**
   * Transporters retrieve available listing delivery routes within their service radius.
   */
  public static async findAvailable(req: Request, res: Response): Promise<void> {
    const transportProviderId = req.user!.userId;
    const result = await DeliveryService.findAvailableDeliveryRequests(transportProviderId);
    res.status(200).json(result);
  }

  /**
   * Transporters accept a delivery request (or entire route group if batched).
   */
  public static async acceptRequest(req: Request, res: Response): Promise<void> {
    const transportProviderId = req.user!.userId;
    const result = await DeliveryService.acceptDeliveryRequest(req.params.id, transportProviderId);
    res.status(200).json(result);
  }

  /**
   * Transporters update transit status states.
   */
  public static async updateStatus(req: Request, res: Response): Promise<void> {
    const actorUserId = req.user!.userId;
    const { status, latitude, longitude } = req.body;

    const location =
      latitude !== undefined && longitude !== undefined
        ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
        : undefined;

    const result = await DeliveryService.updateDeliveryStatus(
      req.params.id,
      status as DeliveryStatus,
      actorUserId,
      location
    );

    res.status(200).json(result);
  }

  /**
   * Transporters update their live location, triggering real-time ETA updates.
   */
  public static async updateLocation(req: Request, res: Response): Promise<void> {
    const transportProviderId = req.user!.userId;
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const result = await DeliveryService.updateLiveLocation(
      id,
      transportProviderId,
      parseFloat(latitude as string),
      parseFloat(longitude as string)
    );

    res.status(200).json(result);
  }

  /**
   * Fetch single delivery request details. Enforces access checks (Transporter, Farmer, or Buyer).
   */
  public static async getDeliveryById(req: Request, res: Response): Promise<void> {
    const requestingUserId = req.user!.userId;

    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!delivery) {
      throw createError('Delivery request not found', 'DELIVERY_NOT_FOUND', 404);
    }

    // Access control: Transporter, Buyer, or Farmer
    const isTransporter = delivery.transportProviderId === requestingUserId;
    const isBuyer = delivery.order.buyerId === requestingUserId;
    const isFarmer = delivery.order.listing.farmerId === requestingUserId;

    if (!isTransporter && !isBuyer && !isFarmer) {
      throw createError('Access forbidden: view permissions required', 'FORBIDDEN_DELIVERY_ACCESS', 403);
    }

    res.status(200).json(delivery);
  }

  /**
   * Public/Auth utility estimating delivery shipping fees.
   */
  public static async getCostEstimate(req: Request, res: Response): Promise<void> {
    const { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, weightKg } = req.query;

    if (
      !pickupLatitude ||
      !pickupLongitude ||
      !dropoffLatitude ||
      !dropoffLongitude ||
      !weightKg
    ) {
      throw createError(
        'Missing required parameters: pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, weightKg',
        'MISSING_ESTIMATE_PARAMETERS',
        400
      );
    }

    const result = await DeliveryService.estimateDeliveryCost(
      parseFloat(pickupLatitude as string),
      parseFloat(pickupLongitude as string),
      parseFloat(dropoffLatitude as string),
      parseFloat(dropoffLongitude as string),
      parseFloat(weightKg as string)
    );

    res.status(200).json(result);
  }

  /**
   * Admin-only manual trigger grouping nearby deliveries.
   */
  public static async triggerManualGrouping(req: Request, res: Response): Promise<void> {
    const result = await DeliveryService.groupNearbyRequests();
    res.status(200).json(result);
  }
}
