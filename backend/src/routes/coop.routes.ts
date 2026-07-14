import { Router } from 'express';
import { CoOpController } from '../controllers/coop.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Retrieve open groups or view details (Public)
router.get('/', CoOpController.getActiveCoOps);
router.get('/:id', CoOpController.getCoOpById);

// Authenticated co-op actions
router.post('/', authenticateToken, CoOpController.createCoOp);
router.post('/:id/join', authenticateToken, CoOpController.joinCoOp);

// Webhook / Callback simulations (Authenticated)
router.post('/payment/simulate', authenticateToken, CoOpController.simulatePayment);
router.post('/admin/expire-stale', authenticateToken, CoOpController.triggerExpiration);

export default router;
