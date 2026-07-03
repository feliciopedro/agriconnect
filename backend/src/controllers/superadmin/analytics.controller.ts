import { Request, Response } from 'express';
import { SuperAdminAnalyticsService } from '../../services/superadmin/analytics.service';
import { createError } from '../../utils/errors';

export class SuperAdminAnalyticsController {
  public static async getPlatformOverview(req: Request, res: Response) {
    const overview = await SuperAdminAnalyticsService.getPlatformOverview();
    res.json(overview);
  }

  public static async getGrowthMetrics(req: Request, res: Response) {
    const periodParam = req.query.period as string;
    const lookbackParam = req.query.lookback as string;

    const period = (periodParam === 'daily' || periodParam === 'weekly' || periodParam === 'monthly')
      ? periodParam
      : 'daily';

    let lookback = parseInt(lookbackParam) || 30;
    if (lookback <= 0 || lookback > 365) {
      lookback = 30;
    }

    const growth = await SuperAdminAnalyticsService.getGrowthMetrics(period, lookback);
    res.json(growth);
  }

  public static async getRegionalBreakdown(req: Request, res: Response) {
    const breakdown = await SuperAdminAnalyticsService.getRegionalBreakdown();
    res.json(breakdown);
  }

  public static async getCropPerformanceReport(req: Request, res: Response) {
    const report = await SuperAdminAnalyticsService.getCropPerformanceReport();
    res.json(report);
  }

  public static async getTransportPerformanceReport(req: Request, res: Response) {
    const report = await SuperAdminAnalyticsService.getTransportPerformanceReport();
    res.json(report);
  }
}
