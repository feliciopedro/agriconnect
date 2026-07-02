import { Router } from 'express';
import { DeliveryController } from '../controllers/delivery.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';
import prisma from '../prisma/client';
import { createError } from '../utils/errors';
import { DeliveryService } from '../services/delivery.service';
import { validate } from '../middleware/validate.middleware';
import {
  UpdateDeliveryStatusSchema,
  GetCostEstimateSchema,
  DeliveryIdParamSchema,
} from '../types/delivery.schema';

const router = Router();

// Globally enforce JWT token checks
router.use(authenticateToken);

// Transporter routes
router.get('/available', requireRole(Role.TRANSPORT), DeliveryController.findAvailable);
router.post(
  '/:id/accept',
  requireRole(Role.TRANSPORT),
  validate(DeliveryIdParamSchema, 'params'),
  DeliveryController.acceptRequest
);
router.patch(
  '/:id/status',
  requireRole(Role.TRANSPORT),
  validate(DeliveryIdParamSchema, 'params'),
  validate(UpdateDeliveryStatusSchema),
  DeliveryController.updateStatus
);

// Estimate configurations
router.get('/estimate', validate(GetCostEstimateSchema, 'query'), DeliveryController.getCostEstimate);

// Supporting both query param /estimate and path-based /:id/estimate
router.get(
  '/:id/estimate',
  validate(DeliveryIdParamSchema, 'params'),
  async (req, res, next) => {
    try {
      const delivery = await prisma.deliveryRequest.findUnique({
        where: { id: req.params.id },
        include: { order: true },
      });
      if (!delivery) {
        return next(createError('Delivery request not found', 'DELIVERY_NOT_FOUND', 404));
      }
      const result = await DeliveryService.estimateDeliveryCost(
        delivery.pickupLatitude,
        delivery.pickupLongitude,
        delivery.dropoffLatitude,
        delivery.dropoffLongitude,
        delivery.order.quantityKg
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Request retrieval
router.get('/:id', validate(DeliveryIdParamSchema, 'params'), DeliveryController.getDeliveryById);

export default router;
