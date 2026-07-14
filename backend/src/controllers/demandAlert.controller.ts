import { Request, Response } from 'express';
import { DemandAlertService } from '../services/demandAlert.service';

export class DemandAlertController {
  /**
   * Create or update a crop alert.
   */
  public static async createAlert(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const { cropType, minQuantityKg, maxPricePerKg, region } = req.body;

    const result = await DemandAlertService.createAlert(buyerId, {
      cropType,
      minQuantityKg: minQuantityKg ? parseFloat(minQuantityKg) : undefined,
      maxPricePerKg: maxPricePerKg ? parseFloat(maxPricePerKg) : undefined,
      region,
    });

    res.status(201).json(result);
  }

  /**
   * Get all crop alerts for the authenticated buyer.
   */
  public static async getMyAlerts(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const result = await DemandAlertService.getAlertsByBuyer(buyerId);
    res.status(200).json(result);
  }

  /**
   * Toggle a crop alert on/off.
   */
  public static async toggleAlert(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const { id: alertId } = req.params;
    const { isActive } = req.body;

    const result = await DemandAlertService.toggleAlert(
      alertId,
      buyerId,
      isActive === true || isActive === 'true'
    );

    res.status(200).json({
      message: 'Alert configuration updated successfully',
      result,
    });
  }
}
