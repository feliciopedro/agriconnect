import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { CreateOrderSchema, OrderIdParamSchema } from '../types/order.schema';
import { Role } from '../prisma/generated-client';

const router = Router();

// Mount JWT check globally on orders router
router.use(authenticateToken);

// Create order (Only BUYER allowed)
router.post(
  '/',
  requireRole(Role.BUYER),
  validate(CreateOrderSchema),
  OrderController.createOrder
);

// Get orders (scoped inside controller by user role)
router.get('/', OrderController.getOrders);

// Get order details
router.get('/:id', validate(OrderIdParamSchema, 'params'), OrderController.getOrderById);

// Cancel order (Only BUYER allowed)
router.patch(
  '/:id/cancel',
  requireRole(Role.BUYER),
  validate(OrderIdParamSchema, 'params'),
  OrderController.cancelOrder
);

export default router;
