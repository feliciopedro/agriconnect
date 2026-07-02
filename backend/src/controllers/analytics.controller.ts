import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  /**
   * Responds with the farmer's aggregated metrics dashboard.
   */
  public static async getFarmerAnalytics(req: Request, res: Response): Promise<void> {
    const farmerId = req.user!.userId;
    const result = await AnalyticsService.getFarmerAnalytics(farmerId);
    res.status(200).json(result);
  }

  /**
   * Responds with the buyer's spending analytics dashboard.
   */
  public static async getBuyerAnalytics(req: Request, res: Response): Promise<void> {
    const buyerId = req.user!.userId;
    const result = await AnalyticsService.getBuyerAnalytics(buyerId);
    res.status(200).json(result);
  }

  /**
   * Admin-only: exports all orders in CSV format.
   */
  public static async exportOrdersCsv(req: Request, res: Response): Promise<void> {
    const { startDate, endDate } = req.query;
    const csvContent = await AnalyticsService.exportOrdersReportCsv(
      startDate as string,
      endDate as string
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="orders-report.csv"');
    res.status(200).send(csvContent);
  }

  /**
   * Admin-only: exports farmer payout reconciliation details in CSV format.
   */
  public static async exportPayoutsCsv(req: Request, res: Response): Promise<void> {
    const csvContent = await AnalyticsService.exportFarmerPayoutsCsv();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="farmer-payouts-reconciliation.csv"');
    res.status(200).send(csvContent);
  }

  /**
   * Admin-only: exports regional spoilage statistics in CSV format.
   */
  public static async exportSpoilageCsv(req: Request, res: Response): Promise<void> {
    const csvContent = await AnalyticsService.exportSpoilageCsv();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="spoilage-statistics.csv"');
    res.status(200).send(csvContent);
  }
}
