import { Router } from 'express';
import { SuperAdminAuditController } from '../../controllers/superadmin/audit.controller';
import { authenticateToken, requireSuperAdmin } from '../../middleware/auth.middleware';

const router = Router();

// Globally require SUPERADMIN authentication for these audit log lookup endpoints
// CRITICAL: DO NOT use the auditAction middleware on these endpoints to avoid an infinite loop of audit log logging!
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get('/', SuperAdminAuditController.getAuditLogs);
router.get('/verify', SuperAdminAuditController.verifyAuditIntegrity);
router.get('/user/:userId', SuperAdminAuditController.getAuditLogsForUser);

export default router;
