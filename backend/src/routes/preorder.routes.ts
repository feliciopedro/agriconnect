import { Router } from 'express';
import { PreOrderController } from '../controllers/preorder.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { CreatePreOrderSchema, PreOrderIdParamSchema, GetDemandSignalsSchema } from '../types/preorder.schema';
import { Role } from '../prisma/generated-client';

const router = Router();

// ── Pre-order routes (buyer-scoped) ────────────────────────────────────────
router.post(
  '/',
  authenticateToken,
  requireRole(Role.BUYER),
  validate(CreatePreOrderSchema),
  PreOrderController.create
);

router.get(
  '/',
  authenticateToken,
  requireRole(Role.BUYER),
  PreOrderController.getMyPreOrders
);

router.get(
  '/:id',
  authenticateToken,
  validate(PreOrderIdParamSchema, 'params'),
  PreOrderController.getById
);

router.patch(
  '/:id/cancel',
  authenticateToken,
  requireRole(Role.BUYER),
  validate(PreOrderIdParamSchema, 'params'),
  PreOrderController.cancel
);

export default router;
