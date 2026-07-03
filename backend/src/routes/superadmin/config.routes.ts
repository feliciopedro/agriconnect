import { Router } from 'express';
import { SuperAdminConfigController } from '../../controllers/superadmin/config.controller';
import { authenticateToken, requireSuperAdmin, auditAction } from '../../middleware/auth.middleware';

const router = Router();

// Globally require SUPERADMIN authentication for these config routes
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get(
  '/config',
  auditAction('SUPERADMIN_CONFIG_VIEW', 'SystemConfig', 'all'),
  SuperAdminConfigController.getAllConfig
);

router.patch(
  '/config/:key',
  auditAction('SUPERADMIN_CONFIG_UPDATE', 'SystemConfig', 'key'),
  SuperAdminConfigController.updateConfig
);

router.post(
  '/maintenance',
  auditAction('SUPERADMIN_MAINTENANCE_TOGGLE', 'SystemConfig', 'maintenance'),
  SuperAdminConfigController.toggleMaintenanceMode
);

router.post(
  '/broadcast',
  auditAction('SUPERADMIN_BROADCAST_SEND', 'Notification', 'broadcast'),
  SuperAdminConfigController.broadcastNotification
);

export default router;
