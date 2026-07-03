import prisma from '../../prisma/client';
import { Role } from '../../prisma/generated-client';
import { createError } from '../../utils/errors';
import { AuditLogService } from '../audit.service';
import { RuntimeConfig } from '../../config/runtimeConfig';
import { config } from '../../config';
import AfricasTalking = require('africastalking');

export class SuperAdminConfigService {
  private static ALLOWED_KEYS = [
    'platform_fee_percent',
    'delivery_base_fee_ghs',
    'delivery_rate_per_km',
    'max_listing_duration_days',
    'platform_active',
    'maintenance_message',
    'weight_surcharge_limit',
    'weight_surcharge_rate',
  ];

  /**
   * Returns all system configurations as a key-value map.
   */
  public static async getAllConfig() {
    const dbConfigs = await prisma.systemConfig.findMany();
    const map: Record<string, string> = {};
    for (const c of dbConfigs) {
      map[c.key] = c.value;
    }
    return map;
  }

  /**
   * Updates a system configuration key.
   */
  public static async updateConfig(actorId: string, key: string, value: string) {
    if (!this.ALLOWED_KEYS.includes(key)) {
      throw createError(`Configuration key '${key}' is not allowed or read-only`, 'BAD_REQUEST', 400);
    }

    const oldConfig = await prisma.systemConfig.findUnique({ where: { key } });
    const oldValue = oldConfig ? oldConfig.value : null;

    const updated = await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, updatedBy: actorId },
      update: { value, updatedBy: actorId },
    });

    await RuntimeConfig.reload();

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'CONFIG_UPDATED',
      targetType: 'SystemConfig',
      targetId: updated.id,
      metadata: { key, oldValue, newValue: value },
    });

    return updated;
  }

  /**
   * Toggles platform active state for maintenance mode.
   */
  public static async toggleMaintenanceMode(actorId: string, active: boolean, message?: string) {
    // Maintenance Mode active => platform_active = false
    const platformActiveVal = active ? 'false' : 'true';

    await prisma.systemConfig.upsert({
      where: { key: 'platform_active' },
      create: { key: 'platform_active', value: platformActiveVal, updatedBy: actorId },
      update: { value: platformActiveVal, updatedBy: actorId },
    });

    if (message !== undefined) {
      await prisma.systemConfig.upsert({
        where: { key: 'maintenance_message' },
        create: { key: 'maintenance_message', value: message || '', updatedBy: actorId },
        update: { value: message || '', updatedBy: actorId },
      });
    }

    await RuntimeConfig.reload();

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'MAINTENANCE_MODE_TOGGLED',
      targetType: 'SystemConfig',
      metadata: { active, message },
    });

    return { active, message };
  }

  /**
   * Sends platform-wide notification & bulk SMS to matching user roles.
   */
  public static async broadcastNotification(
    actorId: string,
    roles: Role[],
    message: string,
    sendSms = false,
    confirm = false
  ) {
    const targetUsers = await prisma.user.findMany({
      where: { role: { in: roles } },
      select: { id: true, phone: true },
    });

    const recipientCount = targetUsers.length;

    // Confirm step required for SMS
    if (sendSms && !confirm) {
      return {
        recipientCount,
        smsSentCount: 0,
        dryRun: true,
      };
    }

    // Bulk create notifications in database
    if (recipientCount > 0) {
      await prisma.notification.createMany({
        data: targetUsers.map((u) => ({
          userId: u.id,
          type: 'BROADCAST',
          message,
          isRead: false,
        })),
      });
    }

    // Send SMS via Africa's Talking API
    if (sendSms && confirm && recipientCount > 0) {
      try {
        const phones = targetUsers.map((u) => u.phone).filter(Boolean);
        if (phones.length > 0) {
          if (
            config.AFRICAS_TALKING_API_KEY &&
            config.AFRICAS_TALKING_API_KEY !== 'mock_africas_talking_api_key'
          ) {
            const at = AfricasTalking({
              apiKey: config.AFRICAS_TALKING_API_KEY,
              username: config.AFRICAS_TALKING_USERNAME || 'sandbox',
            });
            await at.SMS.send({
              to: phones,
              message,
            });
          } else {
            console.log(`[DEV SMS BROADCAST] to ${phones.join(', ')}: ${message}`);
          }
        }
      } catch (error) {
        console.error('Failed to dispatch bulk SMS through Africa\'s Talking:', error);
      }
    }

    await AuditLogService.log({
      actorId,
      actorRole: Role.SUPERADMIN,
      action: 'BROADCAST_SENT',
      targetType: 'User',
      metadata: { roles, recipientCount, sendSms },
    });

    return {
      recipientCount,
      smsSentCount: sendSms ? recipientCount : 0,
      dryRun: false,
    };
  }
}
