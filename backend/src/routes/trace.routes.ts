import { Router } from 'express';
import { TraceController } from '../controllers/trace.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { AdminTraceEventSchema, BatchCodeParamSchema } from '../types/trace.schema';
import { Role } from '../prisma/generated-client';

export const traceRouter = Router();
export const adminTraceRouter = Router();

// Public trace queries (accessible by scanning QR codes)
traceRouter.get('/:batchCode', validate(BatchCodeParamSchema, 'params'), TraceController.getTrace);
traceRouter.get('/:batchCode/qrcode', validate(BatchCodeParamSchema, 'params'), TraceController.getQrCode);

// Admin overrides
adminTraceRouter.patch(
  '/:batchCode/event',
  authenticateToken,
  requireRole(Role.ADMIN),
  validate(BatchCodeParamSchema, 'params'),
  validate(AdminTraceEventSchema),
  TraceController.addAdminEvent
);
