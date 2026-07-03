import { Router } from 'express';
import { SuperAdminUsersController } from '../../controllers/superadmin/users.controller';
import { authenticateToken, requireSuperAdmin, auditAction } from '../../middleware/auth.middleware';

const router = Router();

// Globally require SUPERADMIN authentication for these endpoints
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get(
  '/',
  auditAction('SUPERADMIN_USER_LIST_VIEW', 'User', 'all'),
  SuperAdminUsersController.getAllUsers
);

router.get(
  '/:id',
  auditAction('SUPERADMIN_USER_DETAIL_VIEW', 'User', 'id'),
  SuperAdminUsersController.getUserDetail
);

router.post(
  '/:id/ban',
  auditAction('SUPERADMIN_USER_BAN', 'User', 'id'),
  SuperAdminUsersController.banUser
);

router.post(
  '/:id/unban',
  auditAction('SUPERADMIN_USER_UNBAN', 'User', 'id'),
  SuperAdminUsersController.unbanUser
);

router.post(
  '/:id/promote-admin',
  auditAction('SUPERADMIN_USER_PROMOTE', 'User', 'id'),
  SuperAdminUsersController.promoteToAdmin
);

router.post(
  '/:id/demote-admin',
  auditAction('SUPERADMIN_USER_DEMOTE', 'User', 'id'),
  SuperAdminUsersController.demoteAdmin
);

router.post(
  '/:id/verify',
  auditAction('SUPERADMIN_USER_FORCE_VERIFY', 'User', 'id'),
  SuperAdminUsersController.forceVerifyUser
);

router.post(
  '/:id/impersonate',
  auditAction('SUPERADMIN_USER_IMPERSONATE', 'User', 'id'),
  SuperAdminUsersController.impersonateUser
);

export default router;
