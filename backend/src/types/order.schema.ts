import { z } from 'zod';

/**
 * Validator schema for creating a new purchase order.
 */
export const CreateOrderSchema = z.object({
  listingId: z.string().uuid('Invalid listing identifier. Must be a valid UUID.'),
  quantityKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Quantity must be greater than zero')
  ),
});

export const OrderIdParamSchema = z.object({
  id: z.string().uuid('Invalid order identifier. Must be a valid UUID.'),
});

// Used by payment routes that use :orderId as the param key
export const PaymentOrderParamSchema = z.object({
  orderId: z.string().uuid('Invalid order identifier. Must be a valid UUID.'),
});

export const InitializePaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order identifier. Must be a valid UUID.'),
});
