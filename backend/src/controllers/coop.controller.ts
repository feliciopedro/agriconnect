import { Request, Response } from 'express';
import { CoOpService } from '../services/coop.service';

export class CoOpController {
  /**
   * Start a co-op group buy.
   */
  public static async createCoOp(req: Request, res: Response): Promise<void> {
    const creatorId = req.user!.userId;
    const { listingId, targetQuantity, creatorContributionKg, durationHours } = req.body;

    const result = await CoOpService.createCoOp(
      creatorId,
      listingId,
      parseFloat(targetQuantity),
      parseFloat(creatorContributionKg),
      durationHours ? parseInt(durationHours, 10) : undefined
    );

    res.status(201).json(result);
  }

  /**
   * List all active co-op group buys.
   */
  public static async getActiveCoOps(req: Request, res: Response): Promise<void> {
    const { listingId } = req.query;
    const result = await CoOpService.getActiveCoOps(listingId as string);
    res.status(200).json(result);
  }

  /**
   * Get single co-op details.
   */
  public static async getCoOpById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await CoOpService.getCoOpById(id);
    res.status(200).json(result);
  }

  /**
   * Contribute to an open co-op group buy.
   */
  public static async joinCoOp(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const { id: coOpGroupId } = req.params;
    const { quantityKg } = req.body;

    const result = await CoOpService.joinCoOp(buyerId, coOpGroupId, parseFloat(quantityKg));
    res.status(201).json(result);
  }

  /**
   * Simulate a payment success webhook callback for a co-op member.
   */
  public static async simulatePayment(req: Request, res: Response): Promise<void> {
    const { coOpMemberId, paystackRef } = req.body;

    const result = await CoOpService.confirmMemberPayment(
      coOpMemberId,
      paystackRef || `PAY-COOP-${Date.now()}`
    );

    res.status(200).json({
      message: 'Co-op member payment verified successfully',
      result,
    });
  }

  /**
   * Trigger the expiration scheduler job manually.
   */
  public static async triggerExpiration(req: Request, res: Response): Promise<void> {
    const expiredCount = await CoOpService.expireStaleCoOps();
    res.status(200).json({
      message: 'Co-op groups expiration scan completed',
      expiredCount,
    });
  }
}
