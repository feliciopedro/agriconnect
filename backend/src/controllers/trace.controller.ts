import { Request, Response } from 'express';
import { TraceService } from '../services/trace.service';
import { TraceEventType } from '../prisma/generated-client';
import { config } from '../config';
import QRCode from 'qrcode';

export class TraceController {
  /**
   * Public retrieval of crop batch traceability timeline.
   * Caches response for 60 seconds.
   */
  public static async getTrace(req: Request, res: Response): Promise<void> {
    const { batchCode } = req.params;
    const result = await TraceService.getTraceByBatchCode(batchCode);
    
    // Edge cache responses for 60s
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json(result);
  }

  /**
   * Generates public QR Code PNG buffer mapped by batchCode directly.
   */
  public static async getQrCode(req: Request, res: Response): Promise<void> {
    const { batchCode } = req.params;
    
    // Validate batch existence before streaming QR
    await TraceService.getTraceByBatchCode(batchCode);

    const traceUrl = `${config.FRONTEND_URL}/trace/${batchCode}`;

    res.setHeader('Content-Type', 'image/png');
    const qrPngBuffer = await QRCode.toBuffer(traceUrl, {
      type: 'png',
      width: 300,
      margin: 2,
    });

    res.status(200).send(qrPngBuffer);
  }

  /**
   * Allows platform administrators to manually insert auditing logs.
   */
  public static async addAdminEvent(req: Request, res: Response): Promise<void> {
    const { batchCode } = req.params;
    const { eventType, notes } = req.body;
    const adminUserId = req.user!.userId;

    const result = await TraceService.addAdminTraceEvent(
      batchCode,
      eventType as TraceEventType,
      notes,
      adminUserId
    );

    res.status(201).json(result);
  }
}
