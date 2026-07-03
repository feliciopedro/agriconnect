import { Request, Response } from 'express';
import { SuperAdminConfigService } from '../../services/superadmin/config.service';
import { createError } from '../../utils/errors';
import { Role } from '../../prisma/generated-client';

export class SuperAdminConfigController {
  public static async getAllConfig(req: Request, res: Response) {
    const configMap = await SuperAdminConfigService.getAllConfig();
    res.json(configMap);
  }

  public static async updateConfig(req: Request, res: Response) {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || typeof value !== 'string') {
      throw createError('Configuration value must be a string', 'BAD_REQUEST', 400);
    }

    const updated = await SuperAdminConfigService.updateConfig(req.user!.userId, key, value);
    res.json({ message: 'Configuration updated successfully', config: updated });
  }

  public static async toggleMaintenanceMode(req: Request, res: Response) {
    const { active, message } = req.body;

    if (active === undefined || typeof active !== 'boolean') {
      throw createError('Active flag (boolean) is required', 'BAD_REQUEST', 400);
    }

    const result = await SuperAdminConfigService.toggleMaintenanceMode(req.user!.userId, active, message);
    res.json({ message: `Maintenance mode toggled ${active ? 'ON' : 'OFF'} successfully`, status: result });
  }

  public static async broadcastNotification(req: Request, res: Response) {
    const { roles, message, sendSms, confirm } = req.body;

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      throw createError('At least one target user role is required', 'BAD_REQUEST', 400);
    }

    const invalidRole = roles.find((r) => !Object.values(Role).includes(r));
    if (invalidRole) {
      throw createError(`Invalid target user role: '${invalidRole}'`, 'BAD_REQUEST', 400);
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw createError('Broadcast notification message is required', 'BAD_REQUEST', 400);
    }

    const result = await SuperAdminConfigService.broadcastNotification(
      req.user!.userId,
      roles as Role[],
      message,
      !!sendSms,
      !!confirm
    );

    res.json(result);
  }
}
