import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { Role } from '../prisma/generated-client';
import { AuditLogService } from '../services/audit.service';

export class AdminController {
  /**
   * Platform statistics handler.
   */
  public static async getStats(req: Request, res: Response): Promise<void> {
    const stats = await AdminService.getPlatformStats();
    res.status(200).json(stats);
  }

  /**
   * Search and filter paginated users.
   */
  public static async getUsers(req: Request, res: Response): Promise<void> {
    const role = req.query.role as Role | undefined;
    
    let isVerified: boolean | undefined = undefined;
    if (req.query.isVerified === 'true') isVerified = true;
    if (req.query.isVerified === 'false') isVerified = false;

    const search = req.query.search as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const result = await AdminService.getUsers(
      { role, isVerified, search },
      { page, limit }
    );

    res.status(200).json(result);
  }

  /**
   * User verification update handler.
   */
  public static async verifyUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const updated = await AdminService.verifyUser(id);
    res.status(200).json({ success: true, user: updated });
  }

  /**
   * Unredacted traceability lookup.
   */
  public static async getTrace(req: Request, res: Response): Promise<void> {
    const { batchCode } = req.params;
    const trace = await AdminService.getTraceForAdmin(batchCode);
    res.status(200).json(trace);
  }

  /**
   * Hard listing delete handler.
   */
  public static async deleteListing(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    await AdminService.deleteListing(id);
    res.status(200).json({ success: true, message: 'Listing and all related records hard-deleted.' });
  }

  /**
   * Audit logs retrieval for admins.
   */
  public static async getAuditLogs(req: Request, res: Response): Promise<void> {
    const userId = req.query.userId as string | undefined;
    const action = req.query.action as string | undefined;
    const entityName = req.query.entityName as string | undefined;
    const entityId = req.query.entityId as string | undefined;

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await AuditLogService.getLogs(
      { userId, action, entityName, entityId },
      { page, limit }
    );

    res.status(200).json(result);
  }
}
