import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import listingRoutes from './listing.routes';
import orderRoutes from './order.routes';
import deliveryRoutes from './delivery.routes';
import { traceRouter, adminTraceRouter } from './trace.routes';
import notificationRoutes from './notification.routes';
import messageRoutes from './message.routes';
import reviewRoutes from './review.routes';
import ussdRoutes from './ussd.routes';
import smsRoutes from './sms.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';
import preorderRoutes from './preorder.routes';
import demandRoutes from './demand.routes';
import farmRoutes from './farm.routes';
import invoiceRoutes from './invoice.routes';
import analyticsRoutes from './analytics.routes';
import superadminRoutes from './superadmin.routes';
import superadminAnalyticsRoutes from './superadmin/analytics.routes';
import superadminUsersRoutes from './superadmin/users.routes';
import superadminContentRoutes from './superadmin/content.routes';
import superadminConfigRoutes from './superadmin/config.routes';
import superadminAuditRoutes from './superadmin/audit.routes';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '../prisma/generated-client';
import { DeliveryController } from '../controllers/delivery.controller';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/listings', listingRoutes);
router.use('/orders', orderRoutes);
router.use('/delivery-requests', deliveryRoutes);
router.use('/trace', traceRouter);
router.use('/admin/trace', adminTraceRouter);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/reviews', reviewRoutes);
router.use('/ussd', ussdRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin/analytics', superadminAnalyticsRoutes);
router.use('/superadmin/users', superadminUsersRoutes);
router.use('/superadmin/audit', superadminAuditRoutes);
router.use('/superadmin', superadminContentRoutes);
router.use('/superadmin', superadminConfigRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/preorders', preorderRoutes);
router.use('/demand', demandRoutes);
router.use('/farm', farmRoutes);
router.use('/orders', invoiceRoutes);
router.use('/', analyticsRoutes);
router.use('/', smsRoutes);

// Backwards compatibility endpoint for manual grouping run triggers
router.post(
  '/delivery-requests/group',
  authenticateToken,
  requireRole(Role.ADMIN),
  DeliveryController.triggerManualGrouping
);

export default router;
