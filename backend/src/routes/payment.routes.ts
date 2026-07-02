import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';
import { validate } from '../middleware/validate.middleware';
import { InitializePaymentSchema, PaymentOrderParamSchema } from '../types/order.schema';

const router = Router();

// Secure endpoints for initiating and manual checking payments
router.post('/initialize', authenticateToken, requireRole(Role.BUYER), validate(InitializePaymentSchema), PaymentController.initialize);
router.get('/:orderId/verify', authenticateToken, validate(PaymentOrderParamSchema, 'params'), PaymentController.verify);

export default router;
