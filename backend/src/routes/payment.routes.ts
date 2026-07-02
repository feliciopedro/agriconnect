import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';

const router = Router();

// Secure endpoints for initiating and manual checking payments
router.post('/initialize', authenticateToken, requireRole(Role.BUYER), PaymentController.initialize);
router.get('/:orderId/verify', authenticateToken, PaymentController.verify);

export default router;
