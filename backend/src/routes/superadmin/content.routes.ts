import { Router } from 'express';
import { SuperAdminContentController } from '../../controllers/superadmin/content.controller';
import { authenticateToken, requireSuperAdmin, auditAction } from '../../middleware/auth.middleware';

const router = Router();

// Globally require SUPERADMIN authentication for these endpoints
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get(
  '/listings',
  auditAction('SUPERADMIN_LISTING_LIST_VIEW', 'ProduceListing', 'all'),
  SuperAdminContentController.getAllListings
);

router.get(
  '/listings/:id',
  auditAction('SUPERADMIN_LISTING_DETAIL_VIEW', 'ProduceListing', 'id'),
  SuperAdminContentController.getListingDetail
);

router.patch(
  '/listings/:id/remove',
  auditAction('SUPERADMIN_LISTING_REMOVE', 'ProduceListing', 'id'),
  SuperAdminContentController.removeListing
);

router.patch(
  '/listings/:id/quality',
  auditAction('SUPERADMIN_LISTING_QUALITY_OVERRIDE', 'ProduceListing', 'id'),
  SuperAdminContentController.overrideListingQuality
);

router.get(
  '/orders',
  auditAction('SUPERADMIN_ORDER_LIST_VIEW', 'Order', 'all'),
  SuperAdminContentController.getAllOrders
);

router.get(
  '/orders/:id',
  auditAction('SUPERADMIN_ORDER_DETAIL_VIEW', 'Order', 'id'),
  SuperAdminContentController.getOrderDetail
);

router.post(
  '/orders/:id/cancel',
  auditAction('SUPERADMIN_ORDER_FORCE_CANCEL', 'Order', 'id'),
  SuperAdminContentController.cancelOrderAdmin
);

export default router;
