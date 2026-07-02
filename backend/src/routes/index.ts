import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import listingRoutes from './listing.routes';
import orderRoutes from './order.routes';
import deliveryRoutes from './delivery.routes';
import { traceRouter, adminTraceRouter } from './trace.routes';
import notificationRoutes from './notification.routes';
import messageRoutes from './message.routes';

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

export default router;
