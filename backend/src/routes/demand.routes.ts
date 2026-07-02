import { Router } from 'express';
import { PreOrderController } from '../controllers/preorder.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { GetDemandSignalsSchema } from '../types/preorder.schema';
import { Role } from '../prisma/generated-client';

const router = Router();

// ── Demand signal routes (farmer + admin) ──────────────────────────────────

// Aggregated demand: open pre-orders grouped by crop + region
router.get(
  '/',
  authenticateToken,
  validate(GetDemandSignalsSchema, 'query'),
  PreOrderController.getDemandSignals
);

// Admin: expire stale pre-orders past their harvest window
router.post(
  '/expire',
  authenticateToken,
  requireRole(Role.ADMIN),
  PreOrderController.expireStale
);

export default router;
