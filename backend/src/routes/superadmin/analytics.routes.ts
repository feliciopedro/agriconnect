import { Router } from 'express';
import { SuperAdminAnalyticsController } from '../../controllers/superadmin/analytics.controller';
import { authenticateToken, requireSuperAdmin, auditAction } from '../../middleware/auth.middleware';

const router = Router();

// Require SUPERADMIN authentication globally for these analytics routes
router.use(authenticateToken);
router.use(requireSuperAdmin());

router.get(
  '/overview',
  auditAction('SUPERADMIN_ANALYTICS_OVERVIEW_VIEW', 'Analytics', 'overview'),
  SuperAdminAnalyticsController.getPlatformOverview
);

router.get(
  '/growth',
  auditAction('SUPERADMIN_ANALYTICS_GROWTH_VIEW', 'Analytics', 'growth'),
  SuperAdminAnalyticsController.getGrowthMetrics
);

router.get(
  '/regional',
  auditAction('SUPERADMIN_ANALYTICS_REGIONAL_VIEW', 'Analytics', 'regional'),
  SuperAdminAnalyticsController.getRegionalBreakdown
);

router.get(
  '/crops',
  auditAction('SUPERADMIN_ANALYTICS_CROPS_VIEW', 'Analytics', 'crops'),
  SuperAdminAnalyticsController.getCropPerformanceReport
);

router.get(
  '/transport',
  auditAction('SUPERADMIN_ANALYTICS_TRANSPORT_VIEW', 'Analytics', 'transport'),
  SuperAdminAnalyticsController.getTransportPerformanceReport
);

export default router;
