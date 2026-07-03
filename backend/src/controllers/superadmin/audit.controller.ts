import { Request, Response } from 'express';
import { SuperAdminAuditService } from '../../services/superadmin/audit.service';

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
}
