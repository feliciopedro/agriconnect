import { Router } from 'express';
import { SuperAdminController } from '../controllers/superadmin.controller';
import { authenticateToken, requireSuperAdmin, auditAction } from '../middleware/auth.middleware';

const router = Router();

// Apply superadmin requirements globally to this router
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get('/status', auditAction('SUPERADMIN_STATUS_VIEW'), SuperAdminController.getStatus);
router.post('/users/:id/ban', auditAction('SUPERADMIN_USER_BAN_REQUEST'), SuperAdminController.banUser);
router.post('/users/:id/unban', auditAction('SUPERADMIN_USER_UNBAN_REQUEST'), SuperAdminController.unbanUser);
router.post('/configs', auditAction('SUPERADMIN_CONFIG_UPDATE'), SuperAdminController.updateConfig);
router.get('/audit-logs', auditAction('SUPERADMIN_AUDIT_LOG_VIEW'), SuperAdminController.getAuditLogs);

export default router;
