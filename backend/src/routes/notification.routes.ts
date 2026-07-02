import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Secure notifications routes under authentication guards
router.use(authenticateToken);

router.get('/', NotificationController.getNotifications);
router.patch('/read-all', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);

export default router;
