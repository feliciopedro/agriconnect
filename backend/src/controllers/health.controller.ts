import { Request, Response } from 'express';
import prisma from '../prisma/client';

export class HealthController {
  /**
   * Health probe endpoint returning simple system details.
   */
  public static async checkHealth(req: Request, res: Response): Promise<void> {
    let dbStatus = 'DISCONNECTED';
    let dbError: string | undefined = undefined;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'CONNECTED';
    } catch (error: any) {
      dbError = error.message || String(error);
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      services: {
        database: {
          status: dbStatus,
          error: dbError,
        },
      },
    });
  }
}
