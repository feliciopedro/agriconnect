import { Request, Response } from 'express';
import { SuperAdminUserManagementService } from '../../services/superadmin/userManagement.service';
import { BanUserSchema } from '../../types/superadmin.schema';

export class SuperAdminUsersController {
  public static async getAllUsers(req: Request, res: Response) {
    const {
      role,
      isVerified,
      isBanned,
      region,
      search,
      createdAfter,
      createdBefore,
      limit,
      page,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      role: role as string,
      isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
      isBanned: isBanned !== undefined ? isBanned === 'true' : undefined,
      region: region as string,
      search: search as string,
      createdAfter: createdAfter as string,
      createdBefore: createdBefore as string,
    };

    const pagination = {
      limit: limit ? parseInt(limit as string) : 20,
      page: page ? parseInt(page as string) : 1,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
    };

    const result = await SuperAdminUserManagementService.getAllUsers(filters, pagination);
    res.json(result);
  }

  public static async getUserDetail(req: Request, res: Response) {
    const { id } = req.params;
    const detail = await SuperAdminUserManagementService.getUserDetail(id);
    res.json(detail);
  }

  public static async banUser(req: Request, res: Response) {
    const { id } = req.params;
    const body = BanUserSchema.parse(req.body);
    const result = await SuperAdminUserManagementService.banUser(
      req.user!.userId,
      id,
      body.reason,
      body.expiresAt || undefined
    );
    res.json({ message: 'User banned successfully', ban: result });
  }

  public static async unbanUser(req: Request, res: Response) {
    const { id } = req.params;
    const result = await SuperAdminUserManagementService.unbanUser(req.user!.userId, id);
    res.json({ message: 'User suspension lifted successfully', ban: result });
  }

  public static async promoteToAdmin(req: Request, res: Response) {
    const { id } = req.params;
    const result = await SuperAdminUserManagementService.promoteToAdmin(req.user!.userId, id);
    res.json({ message: 'User promoted to ADMIN successfully', user: result });
  }

  public static async demoteAdmin(req: Request, res: Response) {
    const { id } = req.params;
    const result = await SuperAdminUserManagementService.demoteAdmin(req.user!.userId, id);
    res.json({ message: 'Admin demoted successfully', user: result });
  }

  public static async forceVerifyUser(req: Request, res: Response) {
    const { id } = req.params;
    const result = await SuperAdminUserManagementService.forceVerifyUser(req.user!.userId, id);
    res.json({ message: 'User verified successfully', user: result });
  }

  public static async impersonateUser(req: Request, res: Response) {
    const { id } = req.params;
    const result = await SuperAdminUserManagementService.impersonateUser(req.user!.userId, id);
    res.json(result);
  }
}
