import { Request, Response } from 'express';
import { PreOrderService } from '../services/preorder.service';
import { PreOrderStatus, CropType } from '../prisma/generated-client';

export class PreOrderController {
  /**
   * Creates a new pre-order and returns the Paystack deposit authorization URL.
   */
  public static async create(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const result = await PreOrderService.createPreOrder(buyerId, req.body);
    res.status(201).json(result);
  }

  /**
   * Returns the authenticated buyer's pre-orders, optionally filtered by status.
   */
  public static async getMyPreOrders(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const status = req.query.status as PreOrderStatus | undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const result = await PreOrderService.getMyPreOrders(buyerId, { status, page, limit });
    res.status(200).json(result);
  }

  /**
   * Returns a single pre-order. Accessible by buyer or matched farmer.
   */
  public static async getById(req: Request, res: Response): Promise<void> {
    const requestingUserId = req.user!.userId;
    const { id } = req.params;
    const result = await PreOrderService.getPreOrderById(id, requestingUserId);
    res.status(200).json(result);
  }

  /**
   * Cancels an open pre-order. Triggers admin refund notification if deposit was paid.
   */
  public static async cancel(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const { id } = req.params;
    const result = await PreOrderService.cancelPreOrder(id, buyerId);
    res.status(200).json(result);
  }

  /**
   * Returns aggregated demand signals grouped by crop type and region.
   * Used by farmers and admins to understand pre-harvest demand.
   */
  public static async getDemandSignals(req: Request, res: Response): Promise<void> {
    const cropType = req.query.cropType as CropType | undefined;
    const region = req.query.region as string | undefined;
    const result = await PreOrderService.getDemandSignals({ cropType, region });
    res.status(200).json(result);
  }

  /**
   * Admin-only: expire all stale OPEN pre-orders past their harvest window.
   */
  public static async expireStale(req: Request, res: Response): Promise<void> {
    const result = await PreOrderService.expireStalePreOrders();
    res.status(200).json({
      message: `Expired ${result.expiredCount} stale pre-order(s).`,
      ...result,
    });
  }
}
