import { Request, Response } from 'express';

export class HealthController {
  /**
   * Health probe endpoint returning simple system details.
   */
  public static checkHealth(req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }
}
