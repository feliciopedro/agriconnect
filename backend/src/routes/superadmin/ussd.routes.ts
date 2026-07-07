import { Router } from 'express';
import { SuperAdminUssdController } from '../../controllers/superadmin/ussd.controller';
import { authenticateToken, requireSuperAdmin, auditAction } from '../../middleware/auth.middleware';

const router = Router();

// Apply SUPERADMIN authentication globally to all USSD administrative routes
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get(
  '/sessions',
  auditAction('SUPERADMIN_USSD_SESSIONS_VIEW', 'USSD', 'sessions'),
  SuperAdminUssdController.getSessions
);

router.get(
  '/sessions/:sessionId',
  auditAction('SUPERADMIN_USSD_SESSION_DETAIL_VIEW', 'USSD', 'session-detail'),
  SuperAdminUssdController.getSessionById
);

router.get(
  '/audit',
  auditAction('SUPERADMIN_USSD_AUDIT_LOG_VIEW', 'USSD', 'audit'),
  SuperAdminUssdController.getAuditLogs
);

router.get(
  '/sms-queue',
  auditAction('SUPERADMIN_USSD_SMS_QUEUE_VIEW', 'USSD', 'sms-queue'),
  SuperAdminUssdController.getSmsQueue
);

router.post(
  '/sms-queue/retry',
  auditAction('SUPERADMIN_USSD_SMS_RETRY_TRIGGER', 'USSD', 'sms-retry'),
  SuperAdminUssdController.retrySmsQueue
);

router.get(
  '/stats',
  auditAction('SUPERADMIN_USSD_STATS_VIEW', 'USSD', 'stats'),
  SuperAdminUssdController.getStats
);

export default router;
