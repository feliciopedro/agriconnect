import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { Role } from '../prisma/generated-client';
import { ExportOrdersQuerySchema } from '../types/analytics.schema';

const router = Router();

// ── Farmer Analytics (requires FARMER) ──────────────────────────────────────
router.get(
  '/farmer/analytics',
  authenticateToken,
  requireRole(Role.FARMER),
  AnalyticsController.getFarmerAnalytics
);

// ── Buyer Analytics (requires BUYER) ────────────────────────────────────────
router.get(
  '/buyer/analytics',
  authenticateToken,
  requireRole(Role.BUYER),
  AnalyticsController.getBuyerAnalytics
);

// ── Admin Export / Reports (requires ADMIN) ──────────────────────────────────
router.get(
  '/admin/reports/orders',
  authenticateToken,
  requireRole(Role.ADMIN),
  validate(ExportOrdersQuerySchema, 'query'),
  AnalyticsController.exportOrdersCsv
);

router.get(
  '/admin/reports/payouts',
  authenticateToken,
  requireRole(Role.ADMIN),
  AnalyticsController.exportPayoutsCsv
);

router.get(
  '/admin/reports/spoilage',
  authenticateToken,
  requireRole(Role.ADMIN),
  AnalyticsController.exportSpoilageCsv
);

export default router;
