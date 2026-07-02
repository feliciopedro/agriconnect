import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { DeliveryController } from '../controllers/delivery.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';
import { validate } from '../middleware/validate.middleware';
import { ListingIdParamSchema } from '../types/listing.schema';
import { BatchCodeParamSchema } from '../types/trace.schema';
import { z } from 'zod';

const router = Router();

const UserIdParamSchema = z.object({
  id: z.string().uuid('Invalid user identifier. Must be a valid UUID.'),
});

// Apply admin access control guards globally to this router
router.use(authenticateToken);
router.use(requireRole(Role.ADMIN));

// Platform metrics & administration lookups
router.get('/stats', AdminController.getStats);
router.get('/users', AdminController.getUsers);
router.patch('/users/:id/verify', validate(UserIdParamSchema, 'params'), AdminController.verifyUser);
router.get('/trace/:batchCode', validate(BatchCodeParamSchema, 'params'), AdminController.getTrace);
router.delete('/listings/:id', validate(ListingIdParamSchema, 'params'), AdminController.deleteListing);
router.get('/audit-logs', AdminController.getAuditLogs);

// Manual delivery grouping trigger
router.post('/delivery-requests/group', DeliveryController.triggerManualGrouping);

export default router;
