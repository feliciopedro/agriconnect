import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

const InvoiceIdParamSchema = z.object({
  id: z.string().uuid('Invalid order identifier. Must be a valid UUID.'),
});

router.get(
  '/:id/invoice',
  authenticateToken,
  validate(InvoiceIdParamSchema, 'params'),
  InvoiceController.exportInvoice
);

export default router;
