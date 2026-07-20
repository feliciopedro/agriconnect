import { Request, Response } from 'express';
import { SuperAdminAuditService } from '../../services/superadmin/audit.service';
import { AuditLogService } from '../../services/audit.service';

export class SuperAdminAuditController {
  public static async getAuditLogs(req: Request, res: Response) {
    const {
      actorId,
      action,
      targetType,
      targetId,
      startDate,
      endDate,
      limit,
      page,
    } = req.query;

    const filters = {
      actorId: actorId as string,
      action: action as string,
      targetType: targetType as string,
      targetId: targetId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    };

    const pagination = {
      limit: limit ? parseInt(limit as string) : 50,
      page: page ? parseInt(page as string) : 1,
    };

    const result = await SuperAdminAuditService.getAuditLogs(filters, pagination);
    res.json(result);
  }

  public static async getAuditLogsForUser(req: Request, res: Response) {
    const { userId } = req.params;
    const logs = await SuperAdminAuditService.getAuditLogsForUser(userId);
    res.json(logs);
  }

  public static async verifyAuditIntegrity(req: Request, res: Response) {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
    const integrityReport = await AuditLogService.verifyIntegrity(limit);
    res.json(integrityReport);
  }
}
