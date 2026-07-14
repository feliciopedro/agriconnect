import { Router } from 'express';
import { DemandAlertController } from '../controllers/demandAlert.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to all alert routes
router.use(authenticateToken);

router.post('/', DemandAlertController.createAlert);
router.get('/', DemandAlertController.getMyAlerts);
router.patch('/:id/toggle', DemandAlertController.toggleAlert);

export default router;
