import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { DeliveryController } from '../controllers/delivery.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';

const router = Router();

// Apply admin access control guards globally to this router
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

// Platform metrics & administration lookups
router.get('/stats', AdminController.getStats);
router.get('/users', AdminController.getUsers);
router.patch('/users/:id/verify', AdminController.verifyUser);
router.get('/trace/:batchCode', AdminController.getTrace);
router.delete('/listings/:id', AdminController.deleteListing);

// Manual delivery grouping trigger
router.post('/delivery-requests/group', DeliveryController.triggerManualGrouping);

export default router;
